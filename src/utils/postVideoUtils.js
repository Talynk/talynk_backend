/**
 * Normalize a post with the correct video URL for playback.
 * Prefers HLS when processing is complete; otherwise falls back to raw video_url.
 * Use this whenever returning posts so the frontend gets consistent fullUrl, streamType, hlsReady.
 *
 * @param {Object} post - Post object with video_url, hls_url?, processing_status?
 * @returns {Object} Post with fullUrl, streamType, hlsReady (and thumbnail_url when available)
 *
 * Frontend usage:
 * - fullUrl: Use this as the src for <video> or HLS player - backend chooses best option
 * - streamType: 'hls' | 'raw' - tells frontend which player to use
 *   - 'hls': Use HLS.js or native MSE - fetch .m3u8 playlist, segments load on-demand
 *   - 'raw': Use standard <video src="..."> - fetches entire MP4
 * - hlsReady: true when HLS is available; false when still processing or failed (use raw)
 * - thumbnail_url: Server-generated thumbnail for profile grids, preload placeholders
 */
function withVideoPlaybackUrl(post) {
    const p = typeof post?.toJSON === 'function' ? post.toJSON() : { ...(post || {}) };
    if (p.hls_url && p.processing_status === 'completed') {
        p.fullUrl = p.hls_url;
        p.streamType = 'hls';
    } else if (p.video_url) {
        p.fullUrl = p.video_url;
        p.streamType = 'raw';
    }
    p.hlsReady = !!(p.hls_url && p.processing_status === 'completed');
    return p;
}

module.exports = { withVideoPlaybackUrl };
