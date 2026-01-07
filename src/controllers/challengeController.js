const prisma = require('../lib/prisma');

// Create a new challenge request
exports.createChallenge = async (req, res) => {
    try {
        const {
            name,
            description,
            has_rewards,
            rewards,
            organizer_name,
            organizer_contact,
            start_date,
            end_date,
            min_content_per_account,
            scoring_criteria
        } = req.body;

        const userId = req.user.id;
        const userRole = req.user.role;

        // Only regular users can create challenges, not admins or approvers
        if (userRole === 'admin' || userRole === 'approver') {
            return res.status(403).json({
                status: 'error',
                message: 'Admins and approvers cannot create challenges. Only regular users can organize challenges.'
            });
        }

        // Verify that the user exists in the users table
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            return res.status(404).json({
                status: 'error',
                message: 'User not found'
            });
        }

        // Validate required fields
        if (!name || !organizer_name || !organizer_contact || !start_date || !end_date) {
            return res.status(400).json({
                status: 'error',
                message: 'Missing required fields: name, organizer_name, organizer_contact, start_date, end_date'
            });
        }

        // Validate dates
        const startDate = new Date(start_date);
        const endDate = new Date(end_date);
        const now = new Date();

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid date format'
            });
        }

        if (startDate < now) {
            return res.status(400).json({
                status: 'error',
                message: 'Start date must be in the future'
            });
        }

        if (endDate <= startDate) {
            return res.status(400).json({
                status: 'error',
                message: 'End date must be after start date'
            });
        }

        // Validate rewards if has_rewards is true
        if (has_rewards && !rewards) {
            return res.status(400).json({
                status: 'error',
                message: 'Rewards description is required when has_rewards is true'
            });
        }

        // Create challenge with pending status
        const challenge = await prisma.challenge.create({
            data: {
                name: name.trim(),
                description: description?.trim() || null,
                has_rewards: has_rewards || false,
                rewards: has_rewards ? rewards.trim() : null,
                organizer_id: userId,
                organizer_name: organizer_name.trim(),
                organizer_contact: organizer_contact.trim(),
                start_date: startDate,
                end_date: endDate,
                min_content_per_account: min_content_per_account || 1,
                scoring_criteria: scoring_criteria?.trim() || null,
                status: 'pending'
            },
            include: {
                organizer: {
                    select: {
                        id: true,
                        username: true,
                        email: true
                    }
                }
            }
        });

        res.status(201).json({
            status: 'success',
            message: 'Challenge request submitted successfully. Waiting for admin approval.',
            data: challenge
        });
    } catch (error) {
        console.error('Error creating challenge:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to create challenge',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get all approved and active challenges
exports.getAllChallenges = async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const where = {
            status: {
                in: status ? [status] : ['approved', 'active']
            }
        };

        const [challenges, total] = await Promise.all([
            prisma.challenge.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy: {
                    createdAt: 'desc'
                },
                include: {
                    organizer: {
                        select: {
                            id: true,
                            username: true,
                            display_name: true,
                            profile_picture: true
                        }
                    },
                    _count: {
                        select: {
                            participants: true,
                            posts: true
                        }
                    }
                }
            }),
            prisma.challenge.count({ where })
        ]);

        // Determine if challenge is currently active based on dates
        const challengesWithStatus = challenges.map(challenge => {
            const now = new Date();
            const startDate = new Date(challenge.start_date);
            const endDate = new Date(challenge.end_date);
            
            let isActive = false;
            if (challenge.status === 'active' || challenge.status === 'approved') {
                isActive = now >= startDate && now <= endDate;
            }

            return {
                ...challenge,
                is_currently_active: isActive
            };
        });

        res.json({
            status: 'success',
            data: challengesWithStatus,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error fetching challenges:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch challenges',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get a single challenge by ID
exports.getChallengeById = async (req, res) => {
    try {
        const { challengeId } = req.params;
        const userId = req.user?.id;

        const challenge = await prisma.challenge.findUnique({
            where: { id: challengeId },
            include: {
                organizer: {
                    select: {
                        id: true,
                        username: true,
                        display_name: true,
                        profile_picture: true
                    }
                },
                _count: {
                    select: {
                        participants: true,
                        posts: true
                    }
                }
            }
        });

        if (!challenge) {
            return res.status(404).json({
                status: 'error',
                message: 'Challenge not found'
            });
        }

        // Check if user is a participant
        let isParticipant = false;
        if (userId) {
            const participant = await prisma.challengeParticipant.findUnique({
                where: {
                    unique_challenge_participant: {
                        challenge_id: challengeId,
                        user_id: userId
                    }
                }
            });
            isParticipant = !!participant;
        }

        // Determine if challenge is currently active
        const now = new Date();
        const startDate = new Date(challenge.start_date);
        const endDate = new Date(challenge.end_date);
        const isActive = (challenge.status === 'active' || challenge.status === 'approved') &&
                        now >= startDate && now <= endDate;

        res.json({
            status: 'success',
            data: {
                ...challenge,
                is_currently_active: isActive,
                is_participant: isParticipant
            }
        });
    } catch (error) {
        console.error('Error fetching challenge:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch challenge',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Join a challenge
exports.joinChallenge = async (req, res) => {
    try {
        const { challengeId } = req.params;
        const userId = req.user.id;

        // Check if challenge exists
        const challenge = await prisma.challenge.findUnique({
            where: { id: challengeId }
        });

        if (!challenge) {
            return res.status(404).json({
                status: 'error',
                message: 'Challenge not found'
            });
        }

        // Check if challenge is approved
        if (challenge.status !== 'approved' && challenge.status !== 'active') {
            return res.status(400).json({
                status: 'error',
                message: 'Challenge is not available for participation'
            });
        }

        // Check if user is the organizer
        if (challenge.organizer_id === userId) {
            return res.status(400).json({
                status: 'error',
                message: 'Organizer cannot join their own challenge'
            });
        }

        // Check if challenge is currently active
        const now = new Date();
        const startDate = new Date(challenge.start_date);
        const endDate = new Date(challenge.end_date);

        if (now < startDate) {
            return res.status(400).json({
                status: 'error',
                message: 'Challenge has not started yet'
            });
        }

        if (now > endDate) {
            return res.status(400).json({
                status: 'error',
                message: 'Challenge has ended'
            });
        }

        // Check if already a participant
        const existingParticipant = await prisma.challengeParticipant.findUnique({
            where: {
                unique_challenge_participant: {
                    challenge_id: challengeId,
                    user_id: userId
                }
            }
        });

        if (existingParticipant) {
            return res.status(400).json({
                status: 'error',
                message: 'You are already a participant in this challenge'
            });
        }

        // Add user as participant
        const participant = await prisma.challengeParticipant.create({
            data: {
                challenge_id: challengeId,
                user_id: userId
            },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        display_name: true,
                        profile_picture: true
                    }
                },
                challenge: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });

        res.status(201).json({
            status: 'success',
            message: 'Successfully joined the challenge',
            data: participant
        });
    } catch (error) {
        console.error('Error joining challenge:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to join challenge',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get participants of a challenge (for organizer and participants)
exports.getChallengeParticipants = async (req, res) => {
    try {
        const { challengeId } = req.params;
        const userId = req.user.id;
        const { page = 1, limit = 50 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Check if challenge exists
        const challenge = await prisma.challenge.findUnique({
            where: { id: challengeId },
            select: {
                id: true,
                organizer_id: true,
                status: true
            }
        });

        if (!challenge) {
            return res.status(404).json({
                status: 'error',
                message: 'Challenge not found'
            });
        }

        // Check if user is organizer or participant
        const isOrganizer = challenge.organizer_id === userId;
        const isParticipant = await prisma.challengeParticipant.findUnique({
            where: {
                unique_challenge_participant: {
                    challenge_id: challengeId,
                    user_id: userId
                }
            }
        });

        if (!isOrganizer && !isParticipant) {
            return res.status(403).json({
                status: 'error',
                message: 'You do not have permission to view participants'
            });
        }

        const [participants, total] = await Promise.all([
            prisma.challengeParticipant.findMany({
                where: { challenge_id: challengeId },
                skip,
                take: parseInt(limit),
                orderBy: {
                    joined_at: 'desc'
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            display_name: true,
                            profile_picture: true,
                            posts_count: true,
                            follower_count: true
                        }
                    },
                    _count: {
                        select: {
                            // Count posts submitted to this challenge by this user
                        }
                    }
                }
            }),
            prisma.challengeParticipant.count({
                where: { challenge_id: challengeId }
            })
        ]);

        // Get post counts for each participant
        const participantsWithPostCounts = await Promise.all(
            participants.map(async (participant) => {
                const postCount = await prisma.challengePost.count({
                    where: {
                        challenge_id: challengeId,
                        user_id: participant.user_id
                    }
                });

                return {
                    ...participant,
                    post_count: postCount
                };
            })
        );

        res.json({
            status: 'success',
            data: participantsWithPostCounts,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error fetching participants:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch participants',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get posts for a challenge
exports.getChallengePosts = async (req, res) => {
    try {
        const { challengeId } = req.params;
        const { page = 1, limit = 20 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Check if challenge exists
        const challenge = await prisma.challenge.findUnique({
            where: { id: challengeId }
        });

        if (!challenge) {
            return res.status(404).json({
                status: 'error',
                message: 'Challenge not found'
            });
        }

        const [challengePosts, total] = await Promise.all([
            prisma.challengePost.findMany({
                where: { challenge_id: challengeId },
                skip,
                take: parseInt(limit),
                orderBy: {
                    submitted_at: 'desc'
                },
                include: {
                    post: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    username: true,
                                    display_name: true,
                                    profile_picture: true
                                }
                            },
                            category: {
                                select: {
                                    id: true,
                                    name: true
                                }
                            },
                            _count: {
                                select: {
                                    postLikes: true,
                                    comments: true,
                                    postViews: true
                                }
                            }
                        }
                    },
                    user: {
                        select: {
                            id: true,
                            username: true,
                            display_name: true,
                            profile_picture: true
                        }
                    }
                }
            }),
            prisma.challengePost.count({
                where: { challenge_id: challengeId }
            })
        ]);

        res.json({
            status: 'success',
            data: challengePosts,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error fetching challenge posts:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch challenge posts',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get challenges organized by the current user
exports.getMyChallenges = async (req, res) => {
    try {
        const userId = req.user.id;
        const { status, page = 1, limit = 20 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const where = {
            organizer_id: userId,
            ...(status && { status })
        };

        const [challenges, total] = await Promise.all([
            prisma.challenge.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy: {
                    createdAt: 'desc'
                },
                include: {
                    _count: {
                        select: {
                            participants: true,
                            posts: true
                        }
                    }
                }
            }),
            prisma.challenge.count({ where })
        ]);

        res.json({
            status: 'success',
            data: challenges,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error fetching my challenges:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch challenges',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get challenges the user has joined
exports.getJoinedChallenges = async (req, res) => {
    try {
        const userId = req.user.id;
        const { page = 1, limit = 20 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [participations, total] = await Promise.all([
            prisma.challengeParticipant.findMany({
                where: { user_id: userId },
                skip,
                take: parseInt(limit),
                orderBy: {
                    joined_at: 'desc'
                },
                include: {
                    challenge: {
                        include: {
                            organizer: {
                                select: {
                                    id: true,
                                    username: true,
                                    display_name: true,
                                    profile_picture: true
                                }
                            },
                            _count: {
                                select: {
                                    participants: true,
                                    posts: true
                                }
                            }
                        }
                    }
                }
            }),
            prisma.challengeParticipant.count({
                where: { user_id: userId }
            })
        ]);

        res.json({
            status: 'success',
            data: participations,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error fetching joined challenges:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch joined challenges',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Link a post to a challenge
exports.linkPostToChallenge = async (req, res) => {
    try {
        const { challengeId, postId } = req.params;
        const userId = req.user.id;

        // Check if challenge exists
        const challenge = await prisma.challenge.findUnique({
            where: { id: challengeId }
        });

        if (!challenge) {
            return res.status(404).json({
                status: 'error',
                message: 'Challenge not found'
            });
        }

        // Check if challenge is active
        if (challenge.status !== 'active' && challenge.status !== 'approved') {
            return res.status(400).json({
                status: 'error',
                message: 'Challenge is not active'
            });
        }

        // Check if user is a participant
        const participant = await prisma.challengeParticipant.findUnique({
            where: {
                unique_challenge_participant: {
                    challenge_id: challengeId,
                    user_id: userId
                }
            }
        });

        if (!participant) {
            return res.status(403).json({
                status: 'error',
                message: 'You must join the challenge before submitting posts'
            });
        }

        // Check if post exists and belongs to user
        const post = await prisma.post.findUnique({
            where: { id: postId }
        });

        if (!post) {
            return res.status(404).json({
                status: 'error',
                message: 'Post not found'
            });
        }

        if (post.user_id !== userId) {
            return res.status(403).json({
                status: 'error',
                message: 'You can only link your own posts to challenges'
            });
        }

        // Check if post is already linked to this challenge
        const existingLink = await prisma.challengePost.findUnique({
            where: {
                unique_challenge_post: {
                    challenge_id: challengeId,
                    post_id: postId
                }
            }
        });

        if (existingLink) {
            return res.status(400).json({
                status: 'error',
                message: 'Post is already linked to this challenge'
            });
        }

        // Link post to challenge
        const challengePost = await prisma.challengePost.create({
            data: {
                challenge_id: challengeId,
                post_id: postId,
                user_id: userId
            },
            include: {
                challenge: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                post: {
                    select: {
                        id: true,
                        title: true
                    }
                }
            }
        });

        res.status(201).json({
            status: 'success',
            message: 'Post successfully linked to challenge',
            data: challengePost
        });
    } catch (error) {
        console.error('Error linking post to challenge:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to link post to challenge',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

