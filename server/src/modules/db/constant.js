const VIDEO_VISIBILITIES = {
    PUBLIC : 'Public',
    PRIVATE : 'Private',
    UNLISTED : 'Unlisted',
};

const VIDEO_STATUS = {
    PENDING    : 'pending',
    PROCESSING : 'processing',
    READY      : 'ready',
    FAILED     : 'failed',
    // Legacy alias kept for compatibility with existing DB records
    PROCESSED  : 'processed',
    PUBLISHED  : 'published',
};

// Events emitted over Socket.io to connected clients
const SOCKET_EVENTS = {
    VIDEO_UPLOADED   : 'video:uploaded',
    VIDEO_PROCESSING : 'video:processing',
    VIDEO_READY      : 'video:ready',
    VIDEO_FAILED     : 'video:failed',
};

module.exports = {
    VIDEO_STATUS,
    VIDEO_VISIBILITIES,
    SOCKET_EVENTS,
}