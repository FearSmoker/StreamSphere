import { API_SERVER } from '../constants';

// Resolves a video thumbnail URL using the client's API_SERVER.
export const getThumbnailUrl = (url, fallback = '/assets/images/covers/cover_default.jpg') => {
  if (!url) return fallback;
  
  const cleanUrl = url.trim();
  
  // If it's an absolute URL, check if it's hosted on Cloudinary or another external domain.
  if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
    if (cleanUrl.includes('cloudinary.com') || cleanUrl.includes('res.cloudinary.com')) {
      return cleanUrl;
    }
    try {
      const parsedUrl = new URL(cleanUrl);
      const apiOrigin = new URL(API_SERVER).origin;
      const apiHostname = new URL(API_SERVER).hostname;
      // If the URL is already pointing to an external domain, return it as-is
      if (parsedUrl.hostname !== 'localhost' && parsedUrl.hostname !== '127.0.0.1' && parsedUrl.hostname !== apiHostname) {
        return cleanUrl;
      }
      return `${apiOrigin}${parsedUrl.pathname}`;
    } catch (e) {
      return cleanUrl;
    }
  }

  // Handle relative thumbnail paths
  if (cleanUrl.startsWith('/thumbnails/')) {
    return `${API_SERVER}${cleanUrl}`;
  }
  if (cleanUrl.startsWith('thumbnails/')) {
    return `${API_SERVER}/${cleanUrl}`;
  }

  // Handle uploads directory paths
  if (cleanUrl.startsWith('uploads/thumbnails/')) {
    const filename = cleanUrl.replace('uploads/thumbnails/', '');
    return `${API_SERVER}/thumbnails/${filename}`;
  }
  if (cleanUrl.startsWith('/uploads/thumbnails/')) {
    const filename = cleanUrl.replace('/uploads/thumbnails/', '');
    return `${API_SERVER}/thumbnails/${filename}`;
  }

  // Handle pure filenames
  if (!cleanUrl.includes('/')) {
    return `${API_SERVER}/thumbnails/${cleanUrl}`;
  }

  return cleanUrl;
};
