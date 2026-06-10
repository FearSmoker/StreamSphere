'use strict';

const { ObjectId } = require('mongodb');
const { Show, Video } = require('../../db/collections');
const logger = require('../../../logger');

// Insert a new TV Show document
const insert = async (showData) => {
  try {
    const showPayload = {
      title: showData.title,
      description: showData.description,
      thumbnailUrl: showData.thumbnailUrl,
      coverUrl: showData.coverUrl,
      launchYear: parseInt(showData.launchYear, 10),
      languages: Array.isArray(showData.languages) ? showData.languages : [showData.languages || 'English'],
      seasons: showData.seasons || [],
    };
    return await Show.insert(showPayload);
  } catch (error) {
    logger.error('Error inserting TV Show:', error);
    return error;
  }
};

// Update existing TV Show document
const update = async (id, showData) => {
  try {
    const showProperties = {
      _id: new ObjectId(id),
      ...showData,
    };
    if (showData.launchYear) {
      showProperties.launchYear = parseInt(showData.launchYear, 10);
    }
    return await Show.update(showProperties);
  } catch (error) {
    logger.error('Error updating TV Show:', error);
    return error;
  }
};

// Search / list TV Shows
const search = async (searchObject = {}) => {
  try {
    const filter = searchObject.filterKey
      ? {
          [searchObject.filterKey]: new RegExp(searchObject.filterValue, 'i'),
          isDeleted: false,
        }
      : { isDeleted: false };

    const projection = {
      title: 1,
      description: 1,
      thumbnailUrl: 1,
      coverUrl: 1,
      launchYear: 1,
      languages: 1,
      seasons: 1,
    };

    const sort = searchObject.sortKey
      ? { [searchObject.sortKey]: searchObject.sortValue ?? 1 }
      : { _id: -1 };
    const pageNumber = searchObject.pageNumber || 1;
    const limit      = searchObject.limit      || 10;

    return await Show.search({ filter, projection, sort, pageNumber, limit });
  } catch (error) {
    logger.error('Error searching TV Shows:', error);
    return [];
  }
};

// Fetch TV Show details by ID and populate nested episodes with video data
const getById = async (id) => {
  try {
    const show = await Show.getObjectById(id);
    if (!show || show instanceof Error || show.isDeleted) return null;

    // Collect all episode video IDs across all seasons
    const videoIds = [];
    (show.seasons || []).forEach((season) => {
      (season.episodes || []).forEach((ep) => {
        if (ep.videoId) videoIds.push(new ObjectId(ep.videoId));
      });
    });

    if (videoIds.length === 0) {
      return show;
    }

    // Query all related episode videos
    const videos = await Video.search({
      filter: { _id: { $in: videoIds }, isDeleted: false },
      limit: 1000,
    });
    
    const videoMap = new Map(videos.map(v => [v._id.toString(), v]));

    // Populate video objects into show structure
    const populatedSeasons = (show.seasons || []).map((season) => {
      const populatedEpisodes = (season.episodes || []).map((ep) => {
        const videoDetail = videoMap.get(ep.videoId.toString()) || null;
        return {
          ...ep,
          video: videoDetail,
        };
      }).filter(ep => ep.video !== null); // only include valid non-deleted videos

      // Sort episodes by episodeNumber
      populatedEpisodes.sort((a, b) => a.episodeNumber - b.episodeNumber);

      return {
        ...season,
        episodes: populatedEpisodes,
      };
    });

    // Sort seasons by seasonNumber
    populatedSeasons.sort((a, b) => a.seasonNumber - b.seasonNumber);

    return {
      ...show,
      seasons: populatedSeasons,
    };
  } catch (error) {
    logger.error('Error fetching TV Show by ID:', error);
    return null;
  }
};

// Push an episode video ID reference into a season
const addEpisode = async (showId, seasonNumber, episodeNumber, videoId) => {
  try {
    const show = await Show.getObjectById(showId);
    if (!show || show instanceof Error) {
      throw new Error('Show not found');
    }

    const seasons = show.seasons || [];
    const seasonIdx = seasons.findIndex(s => s.seasonNumber === parseInt(seasonNumber, 10));

    if (seasonIdx === -1) {
      // Create new season with the episode
      seasons.push({
        seasonNumber: parseInt(seasonNumber, 10),
        episodes: [
          {
            episodeNumber: parseInt(episodeNumber, 10),
            videoId: new ObjectId(videoId),
          }
        ]
      });
    } else {
      // Add episode to existing season
      const episodes = seasons[seasonIdx].episodes || [];
      const epIdx = episodes.findIndex(e => e.episodeNumber === parseInt(episodeNumber, 10));

      if (epIdx !== -1) {
        // Overwrite video ID for that episode number
        episodes[epIdx].videoId = new ObjectId(videoId);
      } else {
        episodes.push({
          episodeNumber: parseInt(episodeNumber, 10),
          videoId: new ObjectId(videoId),
        });
      }
      seasons[seasonIdx].episodes = episodes;
    }

    return await Show.update({
      _id: new ObjectId(showId),
      seasons,
    });
  } catch (error) {
    logger.error('Error adding episode to TV Show:', error);
    return error;
  }
};

module.exports = {
  insert,
  update,
  search,
  getById,
  addEpisode,
};
