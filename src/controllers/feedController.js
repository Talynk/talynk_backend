const prisma = require('../lib/prisma');
const { applyFeedReadyFilter } = require('../utils/postFilters');
const { withVideoPlaybackUrl } = require('../utils/postVideoUtils');
const { getClient: getRedisClient, redisReady } = require('../lib/redis');

const FEED_CACHE_TTL = 45; // seconds
const MAX_FEED_LIMIT = 20;
const DEFAULT_FEED_LIMIT = 10;

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function parseFeedParams(query) {
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || DEFAULT_FEED_LIMIT, 1), MAX_FEED_LIMIT);

    let cursor = null;
    if (query.cursor) {
        const d = new Date(query.cursor);
        if (!isNaN(d.getTime())) cursor = d;
    }

    return { limit, cursor };
}

function buildBaseWhere(cursor) {
    const where = applyFeedReadyFilter({ status: 'active', is_frozen: false });
    if (cursor) where.createdAt = { lt: cursor };
    return where;
}

const USER_SELECT = {
    id: true,
    username: true,
    profile_picture: true,
    country: { select: { id: true, name: true, code: true, flag_emoji: true } }
};

function toPublicDTO(post) {
    const p = withVideoPlaybackUrl(post);
    return {
        id: p.id,
        user_id: p.user_id,
        user: p.user || null,
        title: p.title || null,
        caption: p.description || p.content || null,
        playback_url: p.fullUrl || null,
        stream_type: p.streamType || null,
        thumbnail_url: p.thumbnail_url || null,
        like_count: p.likes ?? 0,
        comment_count: p.comment_count ?? 0,
        view_count: p.views ?? 0,
        is_featured: p.is_featured || false,
        created_at: p.createdAt
    };
}

function toPersonalizedDTO(post) {
    const base = toPublicDTO(post);
    base.is_liked = Array.isArray(post.postLikes) && post.postLikes.length > 0;
    base.is_following_author = !!(
        post.user &&
        Array.isArray(post.user.followers) &&
        post.user.followers.length > 0
    );
    return base;
}

function buildNextCursor(posts, limit) {
    if (posts.length < limit) return null;
    const last = posts[posts.length - 1];
    return last.createdAt ? last.createdAt.toISOString() : null;
}

// ---------------------------------------------------------------------------
// Redis cache helpers (best-effort, never blocks the response)
// ---------------------------------------------------------------------------

async function getCachedFeed(key) {
    if (!redisReady()) return null;
    try {
        const raw = await getRedisClient().get(key);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}

async function setCachedFeed(key, data) {
    if (!redisReady()) return;
    try {
        await getRedisClient().set(key, JSON.stringify(data), 'EX', FEED_CACHE_TTL);
    } catch { /* best-effort */ }
}

// ---------------------------------------------------------------------------
// GET /feed/public
// ---------------------------------------------------------------------------

exports.getPublicFeed = async (req, res) => {
    try {
        const { limit, cursor } = parseFeedParams(req.query);

        // Cache only the first page (no cursor)
        const cacheKey = !cursor ? 'feed:public:first_page' : null;
        if (cacheKey) {
            const cached = await getCachedFeed(cacheKey);
            if (cached) {
                return res.json({ status: 'success', data: cached, cached: true });
            }
        }

        const where = buildBaseWhere(cursor);

        const posts = await prisma.post.findMany({
            where,
            select: {
                id: true,
                user_id: true,
                title: true,
                description: true,
                content: true,
                video_url: true,
                hls_url: true,
                thumbnail_url: true,
                processing_status: true,
                type: true,
                likes: true,
                comment_count: true,
                views: true,
                is_featured: true,
                createdAt: true,
                user: { select: USER_SELECT }
            },
            orderBy: { createdAt: 'desc' },
            take: limit
        });

        const dto = posts.map(toPublicDTO);
        const nextCursor = buildNextCursor(posts, limit);

        const responseData = { posts: dto, nextCursor };

        if (cacheKey) setCachedFeed(cacheKey, responseData);

        res.json({ status: 'success', data: responseData, cached: false });
    } catch (error) {
        console.error('[feedController.getPublicFeed]', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching public feed',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ---------------------------------------------------------------------------
// GET /feed/personalized  (JWT required)
// ---------------------------------------------------------------------------

exports.getPersonalizedFeed = async (req, res) => {
    try {
        const currentUserId = req.user.id;
        const { limit, cursor } = parseFeedParams(req.query);

        const cacheKey = !cursor ? `feed:user:${currentUserId}:first_page` : null;
        if (cacheKey) {
            const cached = await getCachedFeed(cacheKey);
            if (cached) {
                return res.json({ status: 'success', data: cached, cached: true });
            }
        }

        const where = buildBaseWhere(cursor);

        const posts = await prisma.post.findMany({
            where,
            select: {
                id: true,
                user_id: true,
                title: true,
                description: true,
                content: true,
                video_url: true,
                hls_url: true,
                thumbnail_url: true,
                processing_status: true,
                type: true,
                likes: true,
                comment_count: true,
                views: true,
                is_featured: true,
                createdAt: true,
                user: {
                    select: {
                        ...USER_SELECT,
                        followers: {
                            where: { followerId: currentUserId },
                            select: { id: true },
                            take: 1
                        }
                    }
                },
                postLikes: {
                    where: { user_id: currentUserId },
                    select: { id: true },
                    take: 1
                }
            },
            orderBy: { createdAt: 'desc' },
            take: limit
        });

        const dto = posts.map(toPersonalizedDTO);
        const nextCursor = buildNextCursor(posts, limit);

        const responseData = { posts: dto, nextCursor };

        if (cacheKey) setCachedFeed(cacheKey, responseData);

        res.json({ status: 'success', data: responseData, cached: false });
    } catch (error) {
        console.error('[feedController.getPersonalizedFeed]', error);
        res.status(500).json({
            status: 'error',
            message: 'Error fetching personalized feed',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
