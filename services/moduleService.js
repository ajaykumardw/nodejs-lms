const Module = require('../model/Module');
const mongoose = require('mongoose');

const createOrUpdateCard = async (req) => {
    try {
      const companyId = req.user;
      const moduleId = req.params.id;
      const { cardId, title, value } = req.body;
 
      // 1. Validate module
      const module = await Module.findOne({ company_id: companyId, _id: moduleId });
  
      if (!module) {
        return { status: false, message: 'Invalid module' };
      }
  
      // 2. Handle embedded cards (assuming module.cards is an array of subdocuments)
      if (!module.cards) {
        module.cards = [];
      }
  
      let card;
  
      if (cardId) {
        // Update existing card
        card = module.cards.id(cardId);
        if (!card) {
          return { status: false, message: 'Card not found' };
        }
        card.title = title;
        card.value = value;
      } else {
        // Create new card
        module.cards.push({ title, value });
      }
  
      await module.save();
  
      return { status: true, message: 'New content saved', cards: module.cards };
    } catch (error) {
      console.error(error);
      return { status: false, message: 'Server error' };
    }
  };

const deleteCard = async (req) => {
  try {
    const companyId = req.user;
    const moduleId = req.params.id;
    const cardId = req.params.card_id;

    // 1. Validate IDs
    if (!mongoose.Types.ObjectId.isValid(moduleId) || !mongoose.Types.ObjectId.isValid(cardId)) {
      return { status: false, message: 'Invalid ID format' };
    }

    // 2. Find the module
    const module = await Module.findOne({ company_id: companyId, _id: moduleId });
    if (!module) {
      return { status: false, message: 'Invalid module' };
    }

    // 3. Find and remove the card
    const card = module.cards.id(cardId);
    if (!card) {
      return { status: false, message: 'Content not found' };
    }

    module.cards = module.cards.filter(card => card._id.toString() !== cardId);
    await module.save(); // save updated module

    return {
      status: true,
      message: 'Content deleted successfully',
      cards: module.cards // return remaining cards
    };
  } catch (error) {
    console.error('Delete Content error:', error);
    return { status: false, message: 'Server error' };
  }
};

const updateCardContentDocuments = async (req) => {
  try {
    const companyId = req.user;
    const moduleId = req.params.id;
    const cardId = req.params.card_id;

    if (!mongoose.Types.ObjectId.isValid(moduleId) || !mongoose.Types.ObjectId.isValid(cardId)) {
      return { status: false, message: 'Invalid ID format' };
    }

    const module = await Module.findOne({ company_id: companyId, _id: moduleId });
    if (!module) {
      return { status: false, message: 'Invalid module' };
    }

    console.log('req.pdfPageCount', req.file);

    // 3. Find the card
    const card = module.cards.id(cardId);
    if (!card) {
      return { status: false, message: 'Content not found' };
    }

    // if (card.content_type !== 'document') {
    //   return { status: false, message: 'Content type is not document' };
    // }
 
    // if (!req.file) {
    //   return { status: false, message: 'No file uploaded' };
    // }
 
    if (req.file) {
      card.content = card.content || {};
      card.content.media = [
        {
          file: req.file.filename,
          type: req.file.mimetype,
          size: req.file.size,
          uploadedAt: new Date(),
          uploadDir: req.file.mimetype === 'application/zip' ? `${req.extractedPath}/index_lms.html` : req.uploadDir
        }
      ];

      if(req.file.mimetype == 'application/pdf'){
        card.content.pdf_page_count = req.pdfPageCount;
      }
    }

    // 8. Update downloadable/shareable flags
    const { downloadable, shareable, title } = req.body;

    if (downloadable !== undefined) {
      card.content.downloadable = downloadable === 'true' || downloadable === true;
    }

    if (shareable !== undefined) {
      card.content.shareable = shareable === 'true' || shareable === true;
    }

    if (title !== undefined) {
      card.title = title;
    }

    card.markModified('content');
    await module.save();

    return {
      status: true,
      message: 'Document uploaded and content updated',
      data: {
        cards: module.cards,
        card: card
      },
    };
  } catch (error) {
    console.error('updateCardContent error:', error);
    return { status: false, message: 'Server error' };
  }
};



const updateCardContentYoutubeVideo = async (req) => {
  try {
    const companyId = req.user;
    const moduleId = req.params.id;
    const cardId = req.params.card_id;

    if (!mongoose.Types.ObjectId.isValid(moduleId) || !mongoose.Types.ObjectId.isValid(cardId)) {
      return { status: false, message: 'Invalid ID format' };
    }

    const module = await Module.findOne({ company_id: companyId, _id: moduleId });
    if (!module) {
      return { status: false, message: 'Invalid module' };
    }

    // 3. Find the card
    const card = module.cards.id(cardId);
    if (!card) {
      return { status: false, message: 'Card not found' };
    }
  
    const { url } = req.body;

    if (url !== undefined) {
      card.content.url = url;
    }

    card.markModified('content');
    await module.save();

    return {
      status: true,
      message: 'Url added and content updated',
      data: {
        cards: module.cards,
        card: card
      },
    };
  } catch (error) {
    console.error('updateCardContent error:', error);
    return { status: false, message: 'Server error' };
  }
};

const updateCardContentQuizContent = async (req) => {
  try {
    const companyId = req.user;
    const moduleId = req.params.id;
    const cardId = req.params.card_id;

    if (!mongoose.Types.ObjectId.isValid(moduleId) || !mongoose.Types.ObjectId.isValid(cardId)) {
      return { status: false, message: 'Invalid ID format' };
    }

    const module = await Module.findOne({ company_id: companyId, _id: moduleId });
    if (!module) {
      return { status: false, message: 'Invalid module' };
    }

    // 3. Find the card
    const card = module.cards.id(cardId);
    if (!card) {
      return { status: false, message: 'Card not found' };
    }
  
    const { questions, title } = req.body;

    card.title = title;
    
    if (questions !== undefined) {
      card.content.questions = questions;
    }

    card.markModified('content');
    await module.save();

    return {
      status: true,
      message: 'Questions added and content updated',
      data: {
        cards: module.cards,
        card: card
      },
    };
  } catch (error) {
    console.error('updateCardContent error:', error);
    return { status: false, message: 'Server error' };
  }
};

const updateSettings = async (req) => {
  try {
    const companyId = req.user;
    const moduleId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(moduleId)) {
      return { status: false, message: 'Invalid ID format' };
    }

    const module = await Module.findOne({ company_id: companyId, _id: moduleId });
    if (!module) {
      return { status: false, message: 'Invalid module' };
    }

    const { leaderboard_points } = req.body;

    if (!module.settings) module.settings = {};

    if (leaderboard_points !== undefined) {
      module.settings.leaderboard_points = leaderboard_points;
    }

    await module.save();

    return {
      status: true,
      message: 'Settings Saved',
      data:[]
    };
  } catch (error) {
    console.error('updateCardContent error:', error);
    return { status: false, message: 'Server error' };
  }
};


const getPaginatedModules = async (req, res) => {
  const companyId = req.user; // or req.query, depending on your setup
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const category = req.query.category;
  const keyword = req.query.keyword;
  
  const filter = { company_id: companyId };

  if (category && category != 'All' && mongoose.Types.ObjectId.isValid(category)) {
    filter.category_id = category;
  }

  
  if (keyword) {
    filter.$or = [
      { title: { $regex: keyword, $options: 'i' } },
      // { description: { $regex: keyword, $options: 'i' } }
    ];
  }

  try {
    const total = await Module.countDocuments(filter);
    const modules = await Module.find(filter).populate('category_id', 'name')
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ created_at: -1 }); // optional sorting

      return {
        status: true,
        message: 'Module fetched',
        data:{
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          data: modules
        }
      };
  } catch (err) {
    console.log('get modules error:', err);
    return { status: false, message: 'Server error' };
  }
};

const deleteModule = async (req) => {
  try {
    const user = req.user;
    const moduleId = req.params.id;

    const module = await Module.findOne({ company_id: user._id, _id: moduleId });
    if (!module) {
      return {
        status: false,
        message: 'Module not found',
      };
    }

    await module.deleteOne();

    return {
      status: true,
      message: 'Module deleted successfully!',
    };
  } catch (err) {
    return {
      status: false,
      message: 'Failed to delete module',
      error: err.message
    };
  }
};

const updateStatus = async (req) => {
  try {
    const user = req.user;
    const moduleId = req.params.id;

    const module = await Module.findOne({ company_id: user._id, _id: moduleId });
    if (!module) {
      return {
        status: false,
        message: 'Module not found',
      };
    }

    const { status } = req.body;

    // Validate allowed statuses
    const allowedStatuses = ['draft', 'published'];
    if (!allowedStatuses.includes(status)) {
      return {
        status: false,
        message: 'Invalid status. Allowed values are "draft" or "published".',
      };
    }

    module.status = status;
    await module.save();

    return {
      status: true,
      message: `Module status updated to ${status}`,
    };
  } catch (err) {
    return {
      status: false,
      message: 'Failed to update module status',
      error: err.message,
    };
  }
};


module.exports = {
    createOrUpdateCard,
    deleteCard,
    updateCardContentDocuments,
    updateCardContentYoutubeVideo,
    updateSettings,
    getPaginatedModules,
    deleteModule,
    updateStatus,
    updateCardContentQuizContent
}