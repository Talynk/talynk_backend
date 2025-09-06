const prisma = require('../lib/prisma');

// Get all categories
exports.getAllCategories = async (req, res) => {
    try {
        const { status = 'active' } = req.query;

        const categories = await prisma.category.findMany({
            where: {
                status: status
            },
            select: {
                id: true,
                name: true,
                description: true,
                status: true,
                _count: {
                    select: {
                        posts: {
                            where: {
                                status: 'approved',
                                is_frozen: false
                            }
                        }
                    }
                }
            },
            orderBy: {
                name: 'asc'
            }
        });

        res.json({
            status: 'success',
            data: categories
        });

    } catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching categories',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get category by ID
exports.getCategoryById = async (req, res) => {
    try {
        const { id } = req.params;

        const category = await prisma.category.findUnique({
            where: { id: parseInt(id) },
            include: {
                posts: {
                    where: {
                        status: 'approved',
                        is_frozen: false
                    },
                    include: {
                        user: {
                            select: {
                                id: true,
                                username: true,
                                profile_picture: true
                            }
                        }
                    },
                    orderBy: {
                        createdAt: 'desc'
                    },
                    take: 10
                },
                _count: {
                    select: {
                        posts: {
                            where: {
                                status: 'approved',
                                is_frozen: false
                            }
                        }
                    }
                }
            }
        });

        if (!category) {
            return res.status(404).json({
                status: 'error',
                message: 'Category not found'
            });
        }

        res.json({
            status: 'success',
            data: category
        });

    } catch (error) {
        console.error('Get category error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching category',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Create new category (Admin only)
exports.createCategory = async (req, res) => {
    try {
        const { name, description } = req.body;

        if (!name) {
            return res.status(400).json({
                status: 'error',
                message: 'Category name is required'
            });
        }

        // Check if category already exists
        const existingCategory = await prisma.category.findFirst({
            where: {
                name: {
                    mode: 'insensitive',
                    equals: name
                }
            }
        });

        if (existingCategory) {
            return res.status(400).json({
                status: 'error',
                message: 'Category with this name already exists'
            });
        }

        const category = await prisma.category.create({
            data: {
                name: name.trim(),
                description: description || null,
                status: 'active'
            }
        });

        res.status(201).json({
            status: 'success',
            message: 'Category created successfully',
            data: category
        });

    } catch (error) {
        console.error('Create category error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error creating category',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Update category (Admin only)
exports.updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, status } = req.body;

        const category = await prisma.category.findUnique({
            where: { id: parseInt(id) }
        });

        if (!category) {
            return res.status(404).json({
                status: 'error',
                message: 'Category not found'
            });
        }

        // Check if new name conflicts with existing category
        if (name && name !== category.name) {
            const existingCategory = await prisma.category.findFirst({
                where: {
                    name: {
                        mode: 'insensitive',
                        equals: name
                    },
                    id: {
                        not: parseInt(id)
                    }
                }
            });

            if (existingCategory) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Category with this name already exists'
                });
            }
        }

        const updatedCategory = await prisma.category.update({
            where: { id: parseInt(id) },
            data: {
                ...(name && { name: name.trim() }),
                ...(description !== undefined && { description }),
                ...(status && { status })
            }
        });

        res.json({
            status: 'success',
            message: 'Category updated successfully',
            data: updatedCategory
        });

    } catch (error) {
        console.error('Update category error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error updating category',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Delete category (Admin only)
exports.deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;

        const category = await prisma.category.findUnique({
            where: { id: parseInt(id) },
            include: {
                _count: {
                    select: {
                        posts: true
                    }
                }
            }
        });

        if (!category) {
            return res.status(404).json({
                status: 'error',
                message: 'Category not found'
            });
        }

        if (category._count.posts > 0) {
            return res.status(400).json({
                status: 'error',
                message: 'Cannot delete category with existing posts. Please reassign posts to other categories first.'
            });
        }

        await prisma.category.delete({
            where: { id: parseInt(id) }
        });

        res.json({
            status: 'success',
            message: 'Category deleted successfully'
        });

    } catch (error) {
        console.error('Delete category error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error deleting category',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get popular categories
exports.getPopularCategories = async (req, res) => {
    try {
        const { limit = 10 } = req.query;

        const categories = await prisma.category.findMany({
            where: {
                status: 'active'
            },
            include: {
                _count: {
                    select: {
                        posts: {
                            where: {
                                status: 'approved',
                                is_frozen: false,
                                createdAt: {
                                    gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
                                }
                            }
                        }
                    }
                }
            },
            orderBy: {
                posts: {
                    _count: 'desc'
                }
            },
            take: parseInt(limit)
        });

        res.json({
            status: 'success',
            data: categories.map(category => ({
                id: category.id,
                name: category.name,
                description: category.description,
                postCount: category._count.posts
            }))
        });

    } catch (error) {
        console.error('Get popular categories error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching popular categories',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};