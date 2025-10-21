const NodeCache = require('node-cache');

// Create cache instances for different data types
const featuredPostsCache = new NodeCache({ 
    stdTTL: 300, // 5 minutes
    checkperiod: 60, // Check for expired keys every minute
    useClones: false // Don't clone objects for better performance
});

const followingPostsCache = new NodeCache({ 
    stdTTL: 180, // 3 minutes
    checkperiod: 60,
    useClones: false
});

const allPostsCache = new NodeCache({ 
    stdTTL: 120, // 2 minutes for all posts (frequently updated)
    checkperiod: 60,
    useClones: false
});

const singlePostCache = new NodeCache({ 
    stdTTL: 600, // 10 minutes for individual posts
    checkperiod: 120,
    useClones: false
});

const searchCache = new NodeCache({ 
    stdTTL: 300, // 5 minutes for search results
    checkperiod: 60,
    useClones: false
});

const userCache = new NodeCache({ 
    stdTTL: 600, // 10 minutes
    checkperiod: 120,
    useClones: false
});

// Cache keys
const CACHE_KEYS = {
    FEATURED_POSTS: 'featured_posts',
    FOLLOWING_POSTS: 'following_posts',
    ALL_POSTS: 'all_posts',
    SINGLE_POST: 'single_post',
    SEARCH_POSTS: 'search_posts',
    USER_FOLLOWING: 'user_following',
    USER_FOLLOWERS: 'user_followers'
};

/**
 * Get cached featured posts
 * @param {string} key - Cache key
 * @returns {Array|null} Cached data or null
 */
const getFeaturedPostsCache = (key) => {
    return featuredPostsCache.get(key);
};

/**
 * Set featured posts cache
 * @param {string} key - Cache key
 * @param {Array} data - Data to cache
 * @param {number} ttl - Time to live in seconds
 */
const setFeaturedPostsCache = (key, data, ttl = 300) => {
    featuredPostsCache.set(key, data, ttl);
};

/**
 * Get cached following posts
 * @param {string} key - Cache key
 * @returns {Array|null} Cached data or null
 */
const getFollowingPostsCache = (key) => {
    return followingPostsCache.get(key);
};

/**
 * Set following posts cache
 * @param {string} key - Cache key
 * @param {Array} data - Data to cache
 * @param {number} ttl - Time to live in seconds
 */
const setFollowingPostsCache = (key, data, ttl = 180) => {
    followingPostsCache.set(key, data, ttl);
};

/**
 * Get cached user data
 * @param {string} key - Cache key
 * @returns {Object|null} Cached data or null
 */
const getUserCache = (key) => {
    return userCache.get(key);
};

/**
 * Set user cache
 * @param {string} key - Cache key
 * @param {Object} data - Data to cache
 * @param {number} ttl - Time to live in seconds
 */
const setUserCache = (key, data, ttl = 600) => {
    userCache.set(key, data, ttl);
};

/**
 * Get cached all posts
 * @param {string} key - Cache key
 * @returns {Array|null} Cached data or null
 */
const getAllPostsCache = (key) => {
    return allPostsCache.get(key);
};

/**
 * Set all posts cache
 * @param {string} key - Cache key
 * @param {Array} data - Data to cache
 * @param {number} ttl - Time to live in seconds
 */
const setAllPostsCache = (key, data, ttl = 120) => {
    allPostsCache.set(key, data, ttl);
};

/**
 * Get cached single post
 * @param {string} key - Cache key
 * @returns {Object|null} Cached data or null
 */
const getSinglePostCache = (key) => {
    return singlePostCache.get(key);
};

/**
 * Set single post cache
 * @param {string} key - Cache key
 * @param {Object} data - Data to cache
 * @param {number} ttl - Time to live in seconds
 */
const setSinglePostCache = (key, data, ttl = 600) => {
    singlePostCache.set(key, data, ttl);
};

/**
 * Get cached search results
 * @param {string} key - Cache key
 * @returns {Array|null} Cached data or null
 */
const getSearchCache = (key) => {
    return searchCache.get(key);
};

/**
 * Set search cache
 * @param {string} key - Cache key
 * @param {Array} data - Data to cache
 * @param {number} ttl - Time to live in seconds
 */
const setSearchCache = (key, data, ttl = 300) => {
    searchCache.set(key, data, ttl);
};

/**
 * Clear cache by pattern
 * @param {string} pattern - Pattern to match cache keys
 */
const clearCacheByPattern = (pattern) => {
    featuredPostsCache.keys().forEach(key => {
        if (key.includes(pattern)) {
            featuredPostsCache.del(key);
        }
    });
    
    followingPostsCache.keys().forEach(key => {
        if (key.includes(pattern)) {
            followingPostsCache.del(key);
        }
    });
    
    allPostsCache.keys().forEach(key => {
        if (key.includes(pattern)) {
            allPostsCache.del(key);
        }
    });
    
    singlePostCache.keys().forEach(key => {
        if (key.includes(pattern)) {
            singlePostCache.del(key);
        }
    });
    
    searchCache.keys().forEach(key => {
        if (key.includes(pattern)) {
            searchCache.del(key);
        }
    });
    
    userCache.keys().forEach(key => {
        if (key.includes(pattern)) {
            userCache.del(key);
        }
    });
};

/**
 * Clear all caches
 */
const clearAllCaches = () => {
    featuredPostsCache.flushAll();
    followingPostsCache.flushAll();
    allPostsCache.flushAll();
    singlePostCache.flushAll();
    searchCache.flushAll();
    userCache.flushAll();
};

/**
 * Get cache statistics
 * @returns {Object} Cache statistics
 */
const getCacheStats = () => {
    return {
        featuredPosts: {
            keys: featuredPostsCache.keys().length,
            stats: featuredPostsCache.getStats()
        },
        followingPosts: {
            keys: followingPostsCache.keys().length,
            stats: followingPostsCache.getStats()
        },
        allPosts: {
            keys: allPostsCache.keys().length,
            stats: allPostsCache.getStats()
        },
        singlePost: {
            keys: singlePostCache.keys().length,
            stats: singlePostCache.getStats()
        },
        search: {
            keys: searchCache.keys().length,
            stats: searchCache.getStats()
        },
        users: {
            keys: userCache.keys().length,
            stats: userCache.getStats()
        }
    };
};

module.exports = {
    CACHE_KEYS,
    getFeaturedPostsCache,
    setFeaturedPostsCache,
    getFollowingPostsCache,
    setFollowingPostsCache,
    getAllPostsCache,
    setAllPostsCache,
    getSinglePostCache,
    setSinglePostCache,
    getSearchCache,
    setSearchCache,
    getUserCache,
    setUserCache,
    clearCacheByPattern,
    clearAllCaches,
    getCacheStats
};
