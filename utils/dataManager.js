const fs = require('fs').promises;
const path = require('path');

class DataManager {
  constructor() {
    this.dataDir = path.join(__dirname, '..', 'data');
    this.ensureDataDirectory();
  }

  async ensureDataDirectory() {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
    } catch (error) {
      console.error('Error creating data directory:', error);
    }
  }

  async loadData(filename, defaultData = []) {
    try {
      const filePath = path.join(this.dataDir, filename);
      const data = await fs.readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.log(`Creating new ${filename} with default data`);
      await this.saveData(filename, defaultData);
      return defaultData;
    }
  }

  async saveData(filename, data) {
    try {
      const filePath = path.join(this.dataDir, filename);
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
      return true;
    } catch (error) {
      console.error(`Error saving ${filename}:`, error);
      return false;
    }
  }

  // Specific data loaders
  async loadBlogPosts() {
    return await this.loadData('blogPosts.json', []);
  }

  async saveBlogPosts(posts) {
    return await this.saveData('blogPosts.json', posts);
  }

  async loadAnalytics() {
    const defaultAnalytics = {
      blogPageViews: {},
      articleExpansions: {},
      contactSubmissions: [],
      pageViews: {},
      customerJourneys: {},
      servicePageViews: {},
      dailyStats: {}
    };
    return await this.loadData('analytics.json', defaultAnalytics);
  }

  async saveAnalytics(analytics) {
    return await this.saveData('analytics.json', analytics);
  }

  async loadMediaLibrary() {
    return await this.loadData('mediaLibrary.json', []);
  }

  async saveMediaLibrary(media) {
    return await this.saveData('mediaLibrary.json', media);
  }

  async loadSocialPosts() {
    return await this.loadData('socialPosts.json', []);
  }

  async saveSocialPosts(posts) {
    return await this.saveData('socialPosts.json', posts);
  }

  async loadGalleryImages() {
    return await this.loadData('galleryImages.json', []);
  }

  async saveGalleryImages(images) {
    return await this.saveData('galleryImages.json', images);
  }

  // Backup functionality
  async createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(this.dataDir, 'backups', timestamp);
    
    try {
      await fs.mkdir(backupDir, { recursive: true });
      
      const files = ['blogPosts.json', 'analytics.json', 'mediaLibrary.json', 'socialPosts.json', 'galleryImages.json'];
      
      for (const file of files) {
        const sourcePath = path.join(this.dataDir, file);
        const backupPath = path.join(backupDir, file);
        
        try {
          await fs.copyFile(sourcePath, backupPath);
        } catch (error) {
          console.log(`File ${file} doesn't exist yet, skipping backup`);
        }
      }
      
      console.log(`Backup created at: ${backupDir}`);
      return backupDir;
    } catch (error) {
      console.error('Error creating backup:', error);
      return null;
    }
  }
}

module.exports = new DataManager();