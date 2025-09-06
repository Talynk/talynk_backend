const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const { 
    validateLoginFields, 
    sanitizeLoginInput, 
    detectLoginType, 
    buildLoginWhereClause,
    createConflictMessage 
} = require('../utils/authUtils');

exports.register = async (req, res) => {
    try {
        const { username, email, password, phone1, phone2 } = req.body;
        
        // Validate required fields - at least one of username or email must be provided
        if (!password || !phone1) {
            return res.status(400).json({
                status: 'error',
                message: 'Password and primary phone number are required'
            });
        }

        if (!username && !email) {
            return res.status(400).json({
                status: 'error',
                message: 'Either username or email (or both) must be provided'
            });
        }

        // Validate email format if provided
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid email format'
            });
        }

        // Validate username format if provided (alphanumeric, underscore, hyphen, 3-30 chars)
        if (username && !/^[a-zA-Z0-9_-]{3,30}$/.test(username)) {
            return res.status(400).json({
                status: 'error',
                message: 'Username must be 3-30 characters long and contain only letters, numbers, underscores, and hyphens'
            });
        }
        
        // Check if user exists with the same username or email
        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [
                    ...(username ? [{ username }] : []),
                    ...(email ? [{ email }] : [])
                ]
            }
        });

        if (existingUser) {
            const conflictField = existingUser.username === username ? 'username' : 'email';
            return res.status(400).json({
                status: 'error',
                message: `${conflictField.charAt(0).toUpperCase() + conflictField.slice(1)} already exists`
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user with provided fields
        const userData = {
            password: hashedPassword,
            phone1,
            phone2: phone2 || null,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        // Add username and email if provided
        if (username) userData.username = username;
        if (email) userData.email = email;

        const user = await prisma.user.create({
            data: userData,
            select: {
                id: true,
                username: true,
                email: true,
                phone1: true,
                phone2: true,
                createdAt: true,
                updatedAt: true
            }
        });
   
        res.status(201).json({
            status: 'success',
            message: 'User registered successfully',
            data: {
                user
            }
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
        const { email, username, password, role, loginField } = req.body;
        
        // Determine what field to use for login (email, username, or auto-detect)
        let loginValue;
        let loginType;
        
        if (loginField) {
            // If loginField is specified, use it
            loginValue = loginField;
            loginType = email ? 'email' : 'username';
        } else if (email) {
            loginValue = email;
            loginType = 'email';
        } else if (username) {
            loginValue = username;
            loginType = 'username';
        } else {
            return res.status(400).json({
                status: 'error',
                message: 'Either email or username (or loginField) and password are required'
            });
        }

        console.log('Login attempt:', { loginValue, loginType, role }); // Debug log

        // Validate input
        if (!password || !role) {
            return res.status(400).json({
                status: 'error',
                message: 'Password and role are required'
            });
        }

        // Find user based on role
        let user;
        
        if (role === 'user') {
            // Build where clause for flexible login
            const whereClause = { role };
            
            if (loginType === 'email') {
                whereClause.email = loginValue;
            } else if (loginType === 'username') {
                whereClause.username = loginValue;
            }

            user = await prisma.user.findFirst({ 
                where: whereClause,
                select: {
                    id: true,
                    email: true,
                    username: true,
                    password: true,
                    role: true,
                    status: true
                }
            });

            // Check if account is frozen
            if (user && user.status === 'frozen') {
                return res.status(403).json({
                    status: 'error',
                    message: 'Your account has been frozen. Please contact support for assistance.'
                });
            }
        } else if (role === 'admin') {
            // Build where clause for admin login
            const whereClause = { status: 'active' };
            
            if (loginType === 'email') {
                whereClause.email = loginValue;
            } else if (loginType === 'username') {
                whereClause.username = loginValue;
            }

            user = await prisma.admin.findFirst({ 
                where: whereClause,
                select: {
                    id: true,
                    email: true,
                    username: true,
                    password: true
                }
            });
            
            // Map admin fields to match user fields for consistent handling
            if (user) {
                user.email = user.email;
                user.username = user.username;
                user.password = user.password;
                user.role = 'admin';
            }
        } else if (role === 'approver') {
            // Build where clause for approver login
            const whereClause = { status: 'active' };
            
            if (loginType === 'email') {
                whereClause.email = loginValue;
            } else if (loginType === 'username') {
                whereClause.username = loginValue;
            }

            user = await prisma.approver.findFirst({ 
                where: whereClause,
                select: {
                    id: true,
                    email: true,
                    username: true,
                    password: true
                }
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

        console.log('User found:', user ? { id: user.id, email: user.email, username: user.username, role: user.role } : null); // Debug log

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
                role: user.role,
                status: user.status // Include status in token
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
                    role: user.role,
                    status: user.status
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
        const refreshToken = req.headers.authorization?.split('Bearer ')[1];

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