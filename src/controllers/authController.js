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
const { createAndSendOTP, verifyOTP } = require('../services/otpService');

/**
 * Step 1: Request OTP for email verification during registration
 * User provides email, we send OTP
 */
exports.requestRegistrationOTP = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                status: 'error',
                message: 'Email is required'
            });
        }

        // Sanitize and validate email
        const sanitizedEmail = sanitizeLoginInput(email, 'email');
        if (!sanitizedEmail) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid email format'
            });
        }

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: { email: sanitizedEmail }
        });

        if (existingUser) {
            return res.status(409).json({
                status: 'error',
                message: 'An account with this email already exists'
            });
        }

        // Create and send OTP
        await createAndSendOTP(sanitizedEmail, 'EMAIL_VERIFICATION');

        res.json({
            status: 'success',
            message: 'OTP code sent to your email. Please check your inbox.'
        });
    } catch (error) {
        console.error('Request OTP error:', error);
        
        // Handle rate limiting error
        if (error.code === 'RATE_LIMIT_EXCEEDED') {
            return res.status(429).json({
                status: 'error',
                message: error.message,
                data: {
                    remainingSeconds: error.remainingSeconds,
                    retryAfter: error.remainingSeconds
                }
            });
        }
        
        // Handle email sending errors
        if (error.message && error.message.includes('Failed to send email')) {
            return res.status(500).json({
                status: 'error',
                message: 'Failed to send OTP code. Please try again later.'
            });
        }
        
        // Generic error
        res.status(500).json({
            status: 'error',
            message: error.message || 'Failed to send OTP code'
        });
    }
};

/**
 * Step 2: Verify OTP code
 * User provides email and OTP code for verification
 */
exports.verifyRegistrationOTP = async (req, res) => {
    try {
        const { email, otpCode } = req.body;

        if (!email || !otpCode) {
            return res.status(400).json({
                status: 'error',
                message: 'Email and OTP code are required'
            });
        }

        // Sanitize email
        const sanitizedEmail = sanitizeLoginInput(email, 'email');
        if (!sanitizedEmail) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid email format'
            });
        }

        // Verify OTP
        const otp = await verifyOTP(sanitizedEmail, otpCode, 'EMAIL_VERIFICATION');

        // Return a temporary token or session identifier for completing registration
        // This token will be used in the next step to verify the user completed OTP
        const verificationToken = jwt.sign(
            {
                email: sanitizedEmail,
                otpId: otp.id,
                purpose: 'registration_verification'
            },
            process.env.JWT_SECRET,
            { expiresIn: '15m' } // Short-lived token for completing registration
        );

        res.json({
            status: 'success',
            message: 'Email verified successfully',
            data: {
                verificationToken,
                email: sanitizedEmail
            }
        });
    } catch (error) {
        console.error('Verify OTP error:', error);
        
        // Handle specific OTP error types
        if (error.code === 'OTP_EXPIRED') {
            return res.status(400).json({
                status: 'error',
                message: error.message,
                data: {
                    code: 'OTP_EXPIRED',
                    action: 'request_new'
                }
            });
        }

        if (error.code === 'OTP_ALREADY_USED') {
            return res.status(400).json({
                status: 'error',
                message: error.message,
                data: {
                    code: 'OTP_ALREADY_USED',
                    action: 'request_new'
                }
            });
        }

        if (error.code === 'INVALID_OTP') {
            return res.status(400).json({
                status: 'error',
                message: error.message,
                data: {
                    code: 'INVALID_OTP'
                }
            });
        }

        // Generic error
        res.status(400).json({
            status: 'error',
            message: error.message || 'Invalid or expired OTP code'
        });
    }
};

/**
 * Step 3: Complete registration after OTP verification
 * User provides password, username, and other details
 */
exports.completeRegistration = async (req, res) => {
    try {
        const { verificationToken, username, display_name, password, country_id, date_of_birth } = req.body;

        if (!verificationToken || !username || !password) {
            return res.status(400).json({
                status: 'error',
                message: 'Verification token, username, and password are required'
            });
        }

        // Verify the verification token
        let decoded;
        try {
            decoded = jwt.verify(verificationToken, process.env.JWT_SECRET);
            if (decoded.purpose !== 'registration_verification') {
                throw new Error('Invalid token purpose');
            }
        } catch (error) {
            return res.status(401).json({
                status: 'error',
                message: 'Invalid or expired verification token. Please verify your email again.'
            });
        }

        const email = decoded.email;

        // Verify OTP was actually verified
        const otp = await prisma.otp.findUnique({
            where: { id: decoded.otpId }
        });

        if (!otp || !otp.verified) {
            return res.status(401).json({
                status: 'error',
                message: 'Email verification not completed. Please verify your email again.'
            });
        }

        // Sanitize inputs
        const sanitizedUsername = sanitizeLoginInput(username, 'username');
        const sanitizedDisplayName = display_name ? String(display_name).trim() : null;

        // Validate username
        if (!sanitizedUsername || sanitizedUsername.length < 3) {
            return res.status(400).json({
                status: 'error',
                message: 'Username must be at least 3 characters long'
            });
        }

        // Validate password
        if (password.length < 6) {
            return res.status(400).json({
                status: 'error',
                message: 'Password must be at least 6 characters long'
            });
        }

        // Check if username is already taken
        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [
                    { username: sanitizedUsername },
                    { email: email }
                ]
            }
        });

        if (existingUser) {
            if (existingUser.username === sanitizedUsername) {
                return res.status(409).json({
                    status: 'error',
                    message: 'Username is already taken'
                });
            }
            if (existingUser.email === email) {
                return res.status(409).json({
                    status: 'error',
                    message: 'Email is already registered'
                });
            }
        }

        // Validate country if provided
        let countryId = null;
        if (country_id) {
            const country = await prisma.country.findUnique({
                where: { id: parseInt(country_id) }
            });

            if (!country) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Invalid country selected'
                });
            }
            countryId = parseInt(country_id);
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const user = await prisma.user.create({
            data: {
                email: email,
                email_verified: true,
                username: sanitizedUsername,
                display_name: sanitizedDisplayName,
                password: hashedPassword,
                country_id: countryId,
                date_of_birth: date_of_birth ? new Date(date_of_birth) : null,
                createdAt: new Date(),
                updatedAt: new Date()
            },
            select: {
                id: true,
                username: true,
                display_name: true,
                email: true,
                email_verified: true,
                country_id: true,
                country: {
                    select: {
                        id: true,
                        name: true,
                        code: true,
                        flag_emoji: true
                    }
                },
                createdAt: true,
                updatedAt: true
            }
        });

        // Clean up the OTP record
        await prisma.otp.delete({
            where: { id: otp.id }
        });

        res.status(201).json({
            status: 'success',
            message: 'Registration completed successfully',
            data: {
                user
            }
        });
    } catch (error) {
        console.error('Complete registration error:', error);
        
        // Handle unique constraint errors
        if (error.code === 'P2002') {
            return res.status(409).json({
                status: 'error',
                message: 'Username or email already exists'
            });
        }

        res.status(500).json({
            status: 'error',
            message: 'Error during registration'
        });
    }
};

/**
 * Legacy register endpoint - kept for backward compatibility but deprecated
 * @deprecated Use requestRegistrationOTP -> verifyRegistrationOTP -> completeRegistration flow instead
 */
exports.register = async (req, res) => {
    try {
        const { username, display_name, email, password, country_id, date_of_birth } = req.body;
        
        // Sanitize inputs
        const sanitizedEmail = email ? sanitizeLoginInput(email, 'email') : null;
        const sanitizedUsername = username ? sanitizeLoginInput(username, 'username') : null;
        const sanitizedDisplayName = display_name ? String(display_name).trim() : null;
        
        // Validate required fields (phone no longer required)
        if (!password) {
            return res.status(400).json({
                status: 'error',
                message: 'Password is required'
            });
        }

        // Validate email and username
        if (!sanitizedEmail || !sanitizedUsername) {
            return res.status(400).json({
                status: 'error',
                message: 'Email and username are required'
            });
        }

        // Validate country_id if provided
        let countryId = null;
        if (country_id) {
        const country = await prisma.country.findUnique({
            where: { id: parseInt(country_id) }
        });

        if (!country) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid country selected'
            });
            }
            countryId = parseInt(country_id);
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
                    { username: sanitizedUsername },
                    { email: sanitizedEmail }
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

        // Create user with provided fields (no phone required)
        const userData = {
            email: sanitizedEmail,
            username: sanitizedUsername,
            password: hashedPassword,
            email_verified: false, // Legacy registration doesn't verify email
            country_id: countryId,
            date_of_birth: date_of_birth ? new Date(date_of_birth) : null,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        if (sanitizedDisplayName) userData.display_name = sanitizedDisplayName;

        const user = await prisma.user.create({
            data: userData,
            select: {
                id: true,
                username: true,
                display_name: true,
                email: true,
                email_verified: true,
                country_id: true,
                country: {
                    select: {
                        id: true,
                        name: true,
                        code: true,
                        flag_emoji: true
                    }
                },
                createdAt: true,
                updatedAt: true
            }
        });
   
        res.status(201).json({
            status: 'success',
            message: 'User registered successfully (Note: Email verification recommended)',
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
            { 
                id: user.id,
                role: user.role
            },
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
    let user;
    const userRole = req.user.role;

    // Find user based on their role
    if (userRole === 'admin') {
      user = await prisma.admin.findUnique({
        where: { id: req.user.id },
        select: {
          id: true,
          username: true,
          email: true,
          status: true,
          last_login: true,
          createdAt: true,
          updatedAt: true
        }
      });
      if (user) user.role = 'admin';
    } else if (userRole === 'approver') {
      user = await prisma.approver.findUnique({
        where: { id: req.user.id },
        select: {
          id: true,
          username: true,
          email: true,
          status: true,
          last_login: true,
          createdAt: true,
          updatedAt: true
        }
      });
      if (user) user.role = 'approver';
    } else {
      // Regular user
      user = await prisma.user.findUnique({
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
    }

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
    const { password, role, country, display_name, bio, ...safeUpdateData } = updateData;
    
    // Handle country update if provided
    let userUpdateData = {
      ...safeUpdateData,
      updatedAt: new Date()
    };

    if (typeof display_name !== 'undefined') {
      userUpdateData.display_name = display_name ? String(display_name).trim() : null;
    }
    
    if (typeof bio !== 'undefined') {
      userUpdateData.bio = bio ? String(bio).trim() : null;
    }
    
    if (country) {
      // Find country by name to get the ID
      const countryRecord = await prisma.country.findFirst({
        where: {
          name: {
            mode: 'insensitive',
            equals: country
          }
        },
        select: { id: true }
      });
      
      if (countryRecord) {
        userUpdateData.country_id = countryRecord.id;
      } else {
        return res.status(400).json({
          status: 'error',
          message: `Country '${country}' not found`
        });
      }
    }
    
    // Update the user
    const updatedUser = await prisma.user.update({
      where: { id: targetUserId },
      data: userUpdateData,
      select: {
        id: true,
        username: true,
        display_name: true,
        email: true,
        phone1: true,
        phone2: true,
        bio: true,
        profile_picture: true,
        country_id: true,
        country: {
          select: {
            id: true,
            name: true,
            code: true,
            flag_emoji: true
          }
        },
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
                    username: true
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
                    username: true
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
                gotToken: refreshToken,
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
                role: decoded.role
            },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        // Generate new refresh token
        const newRefreshToken = jwt.sign(
            {
                id: user.id,
                role: user.role
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

/**
 * Password Reset Flow
 * Step 1: Request OTP for password reset
 */
exports.requestPasswordResetOTP = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                status: 'error',
                message: 'Email is required'
            });
        }

        // Sanitize and validate email
        const sanitizedEmail = sanitizeLoginInput(email, 'email');
        if (!sanitizedEmail) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid email format'
            });
        }

        // Check if user exists
        const user = await prisma.user.findUnique({
            where: { email: sanitizedEmail },
            select: { id: true, email: true }
        });

        if (!user) {
            // Don't reveal if email exists or not (security best practice)
            return res.json({
                status: 'success',
                message: 'If an account exists with this email, a password reset code has been sent.'
            });
        }

        // Create and send OTP
        await createAndSendOTP(sanitizedEmail, 'PASSWORD_RESET', user.id);

        res.json({
            status: 'success',
            message: 'If an account exists with this email, a password reset code has been sent.'
        });
    } catch (error) {
        console.error('Request password reset OTP error:', error);
        
        // Handle rate limiting
        if (error.code === 'RATE_LIMIT_EXCEEDED') {
            return res.status(429).json({
                status: 'error',
                message: error.message,
                data: {
                    remainingSeconds: error.remainingSeconds,
                    retryAfter: error.remainingSeconds
                }
            });
        }
        
        res.status(500).json({
            status: 'error',
            message: error.message || 'Failed to send password reset code'
        });
    }
};

/**
 * Password Reset Flow
 * Step 2: Verify OTP for password reset
 */
exports.verifyPasswordResetOTP = async (req, res) => {
    try {
        const { email, otpCode } = req.body;

        if (!email || !otpCode) {
            return res.status(400).json({
                status: 'error',
                message: 'Email and OTP code are required'
            });
        }

        // Sanitize email
        const sanitizedEmail = sanitizeLoginInput(email, 'email');
        if (!sanitizedEmail) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid email format'
            });
        }

        // Verify OTP
        const otp = await verifyOTP(sanitizedEmail, otpCode, 'PASSWORD_RESET');

        // Get user
        const user = await prisma.user.findUnique({
            where: { email: sanitizedEmail },
            select: { id: true, email: true }
        });

        if (!user) {
            return res.status(404).json({
                status: 'error',
                message: 'User not found'
            });
        }

        // Create a temporary token for password reset
        const resetToken = jwt.sign(
            {
                userId: user.id,
                email: sanitizedEmail,
                otpId: otp.id,
                purpose: 'password_reset'
            },
            process.env.JWT_SECRET,
            { expiresIn: '15m' } // Short-lived token
        );

        res.json({
            status: 'success',
            message: 'OTP verified successfully',
            data: {
                resetToken,
                email: sanitizedEmail
            }
        });
    } catch (error) {
        console.error('Verify password reset OTP error:', error);
        
        // Handle specific OTP errors
        if (error.code === 'OTP_EXPIRED') {
            return res.status(400).json({
                status: 'error',
                message: error.message,
                data: {
                    code: 'OTP_EXPIRED',
                    action: 'request_new'
                }
            });
        }

        if (error.code === 'OTP_ALREADY_USED' || error.code === 'INVALID_OTP') {
            return res.status(400).json({
                status: 'error',
                message: error.message,
                data: {
                    code: error.code
                }
            });
        }

        res.status(400).json({
            status: 'error',
            message: error.message || 'Invalid or expired OTP code'
        });
    }
};

/**
 * Password Reset Flow
 * Step 3: Reset password with verified token
 */
exports.resetPassword = async (req, res) => {
    try {
        const { resetToken, newPassword } = req.body;

        if (!resetToken || !newPassword) {
            return res.status(400).json({
                status: 'error',
                message: 'Reset token and new password are required'
            });
        }

        // Validate password strength
        if (newPassword.length < 6) {
            return res.status(400).json({
                status: 'error',
                message: 'Password must be at least 6 characters long'
            });
        }

        // Verify the reset token
        let decoded;
        try {
            decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
            if (decoded.purpose !== 'password_reset') {
                throw new Error('Invalid token purpose');
            }
        } catch (error) {
            return res.status(401).json({
                status: 'error',
                message: 'Invalid or expired reset token. Please request a new password reset.'
            });
        }

        // Verify OTP was actually verified
        const otp = await prisma.otp.findUnique({
            where: { id: decoded.otpId }
        });

        if (!otp || !otp.verified) {
            return res.status(401).json({
                status: 'error',
                message: 'OTP verification not completed. Please verify your email again.'
            });
        }

        // Get user
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId }
        });

        if (!user) {
            return res.status(404).json({
                status: 'error',
                message: 'User not found'
            });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        await prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                updatedAt: new Date()
            }
        });

        // Clean up the OTP record
        await prisma.otp.delete({
            where: { id: otp.id }
        });

        res.json({
            status: 'success',
            message: 'Password reset successfully. You can now login with your new password.'
        });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error resetting password'
        });
    }
};

/**
 * Account Deletion Flow
 * Requires: Password verification + Email OTP verification
 */
exports.requestAccountDeletionOTP = async (req, res) => {
    try {
        const userId = req.user.id;
        const { password } = req.body;

        if (!password) {
            return res.status(400).json({
                status: 'error',
                message: 'Password is required'
            });
        }

        // Get user
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, email: true, password: true }
        });

        if (!user) {
            return res.status(404).json({
                status: 'error',
                message: 'User not found'
            });
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({
                status: 'error',
                message: 'Invalid password'
            });
        }

        // Create and send OTP for account deletion
        await createAndSendOTP(user.email, 'EMAIL_VERIFICATION', user.id);

        res.json({
            status: 'success',
            message: 'OTP code sent to your email. Please verify to confirm account deletion.'
        });
    } catch (error) {
        console.error('Request account deletion OTP error:', error);
        
        if (error.code === 'RATE_LIMIT_EXCEEDED') {
            return res.status(429).json({
                status: 'error',
                message: error.message,
                data: {
                    remainingSeconds: error.remainingSeconds,
                    retryAfter: error.remainingSeconds
                }
            });
        }
        
        res.status(500).json({
            status: 'error',
            message: error.message || 'Failed to send OTP code'
        });
    }
};

/**
 * Account Deletion Flow
 * Step 2: Verify OTP and delete account
 */
exports.deleteAccount = async (req, res) => {
    try {
        const userId = req.user.id;
        const { password, otpCode } = req.body;

        if (!password || !otpCode) {
            return res.status(400).json({
                status: 'error',
                message: 'Password and OTP code are required'
            });
        }

        // Get user
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, email: true, password: true }
        });

        if (!user) {
            return res.status(404).json({
                status: 'error',
                message: 'User not found'
            });
        }

        // Verify password again
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({
                status: 'error',
                message: 'Invalid password'
            });
        }

        // Verify OTP
        const otp = await verifyOTP(user.email, otpCode, 'EMAIL_VERIFICATION');

        // Verify OTP belongs to this user
        if (otp.user_id !== user.id) {
            return res.status(401).json({
                status: 'error',
                message: 'Invalid OTP code'
            });
        }

        // Delete user account (Cascade will handle related records)
        await prisma.user.delete({
            where: { id: user.id }
        });

        // Clean up OTP
        await prisma.otp.delete({
            where: { id: otp.id }
        }).catch(() => {
            // Ignore if already deleted
        });

        res.json({
            status: 'success',
            message: 'Account deleted successfully'
        });
    } catch (error) {
        console.error('Delete account error:', error);
        
        if (error.code === 'OTP_EXPIRED' || error.code === 'OTP_ALREADY_USED' || error.code === 'INVALID_OTP') {
            return res.status(400).json({
                status: 'error',
                message: error.message,
                data: {
                    code: error.code
                }
            });
        }
        
        res.status(500).json({
            status: 'error',
            message: 'Error deleting account'
        });
    }
}; 