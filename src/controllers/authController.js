const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Admin = require('../models/Admin');
const Approver = require('../models/Approver');
const { Op } = require('sequelize');
const { TIME } = require('@sequelize/core/_non-semver-use-at-your-own-risk_/data-types.js');

exports.register = async (req, res) => {
    try {
        const { username, email, password } = req.body;
        // Check if user exists
        const existingUser = await User.findOne({
            where: {
                [Op.or]: [{ username }, { email }]
            }
        });

        if (existingUser) {
            return res.status(400).json({
                status: 'error',
                message: 'Username or email already exists'
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const user = await User.create({
            username,
            email,
            password: hashedPassword,
            createdAt: new Date(),
            updatedAt: new Date()
        });
   
        res.status(201).json({
            status: 'success',
            message: 'User registered successfully'
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error during registration'
        });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password, role } = req.body;
        console.log('Login attempt:', { email, role }); // Debug log

        // Validate input
        if (!email || !password || !role) {
            return res.status(400).json({
                status: 'error',
                message: 'Email, password and role are required'
            });
        }

        // Find user based on role
        let user;
        
        if (role === 'user') {
            user = await User.findOne({ 
                where: { 
                    email,
                    role
                },
                attributes: ['id', 'email', 'username', 'password', 'role']
            });
        } else if (role === 'admin') {
            user = await Admin.findOne({ 
                where: { 
                    email,
                    status: 'active'
                },
                attributes: ['id', 'email', 'username', 'password']
            });
            
            // Map admin fields to match user fields for consistent handling
            if (user) {
                user.email = user.email;
                user.username = user.username;
                user.password = user.password;
                user.role = 'admin';
            }
        } else if (role === 'approver') {
            user = await Approver.findOne({ 
                where: { 
                    email,
                    status: 'active'
                },
                attributes: ['id', 'email', 'username', 'password']
            });
            
            // Set role for approver
            if (user) {
                user.role = 'approver';
            }
        } else {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid role specified'
            });
        }

        console.log('User found:', user ? { id: user.id, email: user.email || user.adminEmail, role: user.role } : null); // Debug log

        if (!user) {
            return res.status(401).json({
                status: 'error',
                message: 'Invalid credentials'
            });
        }

        console.log('Plain password from request:', password);
        console.log('Hashed password from DB:', user.password || user.adminPassword);
        
        // Compare password based on user type
        const passwordToCompare = user.password || user.adminPassword;
        const isValid = await bcrypt.compare(password, passwordToCompare);
        
        console.log('Password comparison result:', isValid);
        
        if (!isValid) {
            return res.status(401).json({
                status: 'error',
                message: 'Invalid credentials'
            });
        }

        // Update last login time based on user type
        if (role === 'user') {
            await User.update(
                { lastLoginAt: new Date() },
                { where: { id: user.id } }
            );
        } else if (role === 'admin') {
            await Admin.update(
                { lastloginat: new Date() },
                { where: { id: user.id } }
            );
        } else if (role === 'approver') {
            await Approver.update(
                { lastLoginAt: new Date() },
                { where: { id: user.id } }
            );
        }

        // Generate tokens
        const accessToken = jwt.sign(
            { 
                id: user.id, 
                email: user.email,
                username: user.username, 
                role: user.role 
            },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        const refreshToken = jwt.sign(
            { id: user.id },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: '30d' }
        );

        res.json({
            status: 'success',
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    username: user.username,
                    role: user.role
                },
                accessToken,
                refreshToken
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });

    res.json({
      status: 'success',
      data: { user }
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching profile'
    });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { username } = req.params;
    const updateData = req.body;
    
    // If username is provided in params, update that user (admin functionality)
    // Otherwise update the logged-in user's profile
    const user = username 
      ? await User.findOne({ where: { username } })
      : await User.findByPk(req.user.id);

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // If updating another user, check if current user is admin
    if (username && req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to update other users'
      });
    }

    // Remove sensitive fields that shouldn't be updated directly
    const { password, role, ...safeUpdateData } = updateData;
    
    // Update the user
    await user.update(safeUpdateData);

    res.json({
      status: 'success',
      message: 'Profile updated successfully',
      data: {
        username: user.username,
        email: user.email,
        phone1: user.phone1,
        phone2: user.phone2,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error updating profile'
    });
  }
};

exports.logout = async (req, res) => {
  try {
    // Since we're using JWT, we don't need to do anything server-side
    // The client will remove the token
    res.json({
      status: 'success',
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error during logout',
      error: error.message
    });
  }
};

// Add a verify token endpoint for testing
exports.verifyToken = async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({
                status: 'error',
                message: 'No token provided'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        
        res.json({
            status: 'success',
            data: {
                decoded
            }
        });
    } catch (error) {
        res.status(401).json({
            status: 'error',
            message: 'Invalid token'
        });
    }
};

exports.refreshToken = async (req, res) => {
    try {
        // Get the refresh token from the request header
        const refreshToken = req.headers.authorization?.split(' ')[1];

        if (!refreshToken) {
            return res.status(401).json({
                status: 'error',
                message: 'No refresh token provided'
            });
        }

        // Verify the refresh token
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

        // Find the user based on the decoded token
        let user;
        if (decoded.role === 'admin') {
            user = await Admin.findOne({ 
                where: { 
                    id: decoded.id,
                    status: 'active' 
                }
            });
            
            // Map admin fields to match user fields for consistent handling
            if (user) {
                user.email = user.adminEmail;
                user.username = user.adminName;
                user.role = 'admin';
            }
        } else if (decoded.role === 'approver') {
            user = await Approver.findOne({ 
                where: { 
                    id: decoded.id,
                    status: 'active' 
                }
            });
            
            if (user) {
                user.role = 'approver';
            }
        } else if (decoded.role === 'user') {
            user = await User.findOne({ 
                where: { 
                    id: decoded.id,
                    role: 'user'
                }
            });
        }

        if (!user) {
            return res.status(401).json({
                status: 'error',
                message: 'Invalid refresh token'
            });
        }

        // Generate new access token
        const accessToken = jwt.sign(
            {
                id: user.id,
                email: user.email || user.adminEmail,
                username: user.username || user.adminName,
                role: decoded.role,
                ...(decoded.role !== 'user' && user.permissions && { permissions: user.permissions })
            },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        // Generate new refresh token
        const newRefreshToken = jwt.sign(
            {
                id: user.id,
                role: decoded.role
            },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: '30d' }
        );

        // Prepare user data for response
        const userData = {
            id: user.id,
            email: user.email || user.adminEmail,
            username: user.username || user.adminName,
            role: decoded.role
        };
        
        // Add permissions for admin and approver roles
        if (decoded.role !== 'user' && user.permissions) {
            userData.permissions = user.permissions;
        }

        res.json({
            status: 'success',
            data: {
                accessToken,
                refreshToken: newRefreshToken,
                user: userData
            }
        });

    } catch (error) {
        console.error('Token refresh error:', error);
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                status: 'error',
                message: 'Invalid refresh token'
            });
        }

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                status: 'error',
                message: 'Refresh token expired'
            });
        }

        res.status(500).json({
            status: 'error',
            message: 'Failed to refresh token'
        });
    }
}; 