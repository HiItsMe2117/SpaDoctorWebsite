require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const dataManager = require('./utils/dataManager');

// Category mappings for existing posts
const categoryMappings = {
  "5 Signs Your Hot Tub Needs Professional Repair": "troubleshooting-repair",
  "Winter Hot Tub Maintenance: Essential Tips for Cold Weather": "seasonal-moving",
  "Hot Tub Water Chemistry Made Simple: A Beginner's Guide": "maintenance-care",
  "How Often Should You Change Your Hot Tub Water?": "maintenance-care",
  "Hot Tub Filter Maintenance: Clean Filters = Clean Water": "maintenance-care",
  "Why Is My Hot Tub Not Heating? Troubleshooting Guide": "troubleshooting-repair",
  "Hot Tub Cover Care: Extend Life and Save Energy": "maintenance-care",
  "Understanding Hot Tub Jets: Types, Function, and Maintenance": "maintenance-care",
  "Hot Tub Electrical Safety: What Every Owner Should Know": "safety-electrical",
  "Hot Tub Pump Problems: Diagnosis and Solutions": "troubleshooting-repair",
  "Preparing Your Hot Tub for a Move: Professional Transport Guide": "seasonal-moving",
  "When to Call a Professional: Hot Tub Repair vs. DIY": "professional-services"
};

// Category definitions
const categories = {
  "maintenance-care": {
    name: "Maintenance & Care",
    description: "Regular upkeep, cleaning, and preventive care for your hot tub",
    icon: "🧽"
  },
  "troubleshooting-repair": {
    name: "Troubleshooting & Repair",
    description: "Common problems, repairs, and diagnostic guides",
    icon: "🔧"
  },
  "safety-electrical": {
    name: "Safety & Electrical",
    description: "Safety tips, electrical guidelines, and code compliance",
    icon: "⚡"
  },
  "seasonal-moving": {
    name: "Seasonal & Moving",
    description: "Winter care, transport, and seasonal preparation",
    icon: "🚚"
  },
  "professional-services": {
    name: "Professional Services",
    description: "When to call experts and professional service information",
    icon: "👨‍🔧"
  }
};

async function addCategoriesToPosts() {
  try {
    console.log('🏷️  Adding categories to blog posts...');
    
    // Load existing blog posts
    let blogPosts = await dataManager.loadBlogPosts();
    console.log(`📚 Found ${blogPosts.length} blog posts`);
    
    let updatedCount = 0;
    
    // Add categories to each post
    blogPosts.forEach(post => {
      if (!post.category && categoryMappings[post.title]) {
        post.category = categoryMappings[post.title];
        updatedCount++;
        console.log(`✅ Added "${categories[post.category].name}" to: "${post.title}"`);
      } else if (!post.category) {
        // Default category for any posts without mapping
        post.category = "maintenance-care";
        updatedCount++;
        console.log(`✅ Added default category to: "${post.title}"`);
      }
    });
    
    // Save updated posts
    if (updatedCount > 0) {
      await dataManager.saveBlogPosts(blogPosts);
      console.log(`🎉 Successfully updated ${updatedCount} blog posts with categories`);
    } else {
      console.log('ℹ️  All posts already have categories');
    }
    
    // Display category summary
    console.log('\n📊 Category Summary:');
    Object.entries(categories).forEach(([key, category]) => {
      const count = blogPosts.filter(post => post.category === key).length;
      console.log(`   ${category.icon} ${category.name}: ${count} posts`);
    });
    
  } catch (error) {
    console.error('❌ Error adding categories:', error);
  }
}

// Run the category addition
addCategoriesToPosts();