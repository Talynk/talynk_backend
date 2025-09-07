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
        
        // Sanitize inputs
        const sanitizedEmail = email ? sanitizeLoginInput(email, 'email') : null;
        const sanitizedUsername = username ? sanitizeLoginInput(username, 'username') : null;

        // Validate required fields
        if (!password || !phone1) {
            return res.status(400).json({
                status: 'error',
                message: 'Password and primary phone number are required'
            });
        }

        // Validate login fields using utility function
        const validation = validateLoginFields(sanitizedEmail, sanitizedUsername);
        if (!validation.isValid) {
            return res.status(400).json({
                status: 'error',
                message: validation.errors.join(', ')
            });
        }
        
        // Check if user exists with the same username or email
        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [
                    ...(sanitizedUsername ? [{ username: sanitizedUsername }] : []),
                    ...(sanitizedEmail ? [{ email: sanitizedEmail }] : [])
                ]
            }
        });

        if (existingUser) {
            const conflictMessage = createConflictMessage(existingUser, sanitizedEmail, sanitizedUsername);
            return res.status(400).json({
                status: 'error',
                message: conflictMessage
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
        if (sanitizedUsername) userData.username = sanitizedUsername;
        if (sanitizedEmail) userData.email = sanitizedEmail;

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
        
        // Determine what field to use for login
        let loginValue;
        let loginType;
        
        if (loginField) {
            // If loginField is specified, auto-detect the type
            loginValue = sanitizeLoginInput(loginField, 'auto');
            loginType = detectLoginType(loginValue);
        } else if (email) {
            loginValue = sanitizeLoginInput(email, 'email');
            loginType = 'email';
        } else if (username) {
            loginValue = sanitizeLoginInput(username, 'username');
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
            const whereClause = buildLoginWhereClause(loginValue, loginType, { role });

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
            const whereClause = buildLoginWhereClause(loginValue, loginType, { status: 'active' });

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
            const whereClause = buildLoginWhereClause(loginValue, loginType, { status: 'active' });

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
            await prisma.user.update({
                where: { id: user.id },
                data: { last_login: new Date() }
            });
        } else if (role === 'admin') {
            await prisma.admin.update({
                where: { id: user.id },
                data: { last_login: new Date() }
            });
        } else if (role === 'approver') {
            await prisma.approver.update({
                where: { id: user.id },
                data: { last_login: new Date() }
            });
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
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        username: true,
        email: true,
        phone1: true,
        phone2: true,
        role: true,
        status: true,
        posts_count: true,
        total_profile_views: true,
        createdAt: true,
        updatedAt: true,
        last_login: true,
        country: {
          select: {
            id: true,
            name: true,
            code: true,
            flag_emoji: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

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
    const targetUserId = username 
      ? (await prisma.user.findFirst({ where: { username }, select: { id: true } }))?.id
      : req.user.id;

    if (!targetUserId) {
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
    const updatedUser = await prisma.user.update({
      where: { id: targetUserId },
      data: {
        ...safeUpdateData,
        updatedAt: new Date()
      },
      select: {
        id: true,
        username: true,
        email: true,
        phone1: true,
        phone2: true,
        updatedAt: true
      }
    });

    res.json({
      status: 'success',
      message: 'Profile updated successfully',
      data: updatedUser
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
            user = await prisma.admin.findFirst({ 
                where: { 
                    id: decoded.id,
                    status: 'active' 
                },
                select: {
                    id: true,
                    email: true,
                    username: true,
                    permissions: true
                }
            });
            
            // Map admin fields to match user fields for consistent handling
            if (user) {
                user.role = 'admin';
            }
        } else if (decoded.role === 'approver') {
            user = await prisma.approver.findFirst({ 
                where: { 
                    id: decoded.id,
                    status: 'active' 
                },
                select: {
                    id: true,
                    email: true,
                    username: true,
                    permissions: true
                }
            });
            
            if (user) {
                user.role = 'approver';
            }
        } else if (decoded.role === 'user') {
            user = await prisma.user.findFirst({ 
                where: { 
                    id: decoded.id,
                    role: 'user'
                },
                select: {
                    id: true,
                    email: true,
                    username: true,
                    role: true
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
                email: user.email,
                username: user.username,
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
            email: user.email,
            username: user.username,
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