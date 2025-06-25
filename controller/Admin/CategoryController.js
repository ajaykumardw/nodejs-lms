require('dotenv').config();
const Category = require('../../model/Category');
const { successResponse, errorResponse, warningResponse } = require('../../util/response');

const getCategoryAPI = async (req, res, next) => {
    try {
        const companyId = req.user?._id || req.userId;
        const type = req.query.type;
        const filter = { company_id: companyId, type: type };

        // If status is present in query, add it to the filter
        if (req.query.status !== undefined) {
            filter.status = req.query.status === 'true';
        }

        const data = await Category.find(filter).select('name status');

        return successResponse(res, "Category fetched successfully!", data);
    } catch (error) {
        next(error);
    }
};


const postCategoryAPI = async (req, res, next) => {
    try {
      const { name, status, type } = req.body;
      const user = req.user;

      if (!name || !type || typeof status === 'undefined') {
        return warningResponse(res, "Name, type and status are required fields.", {}, 400);
      }
  
      //Check for existing category with same name under same company
      const existing = await Category.findOne({
        company_id: user._id,
        type: type,
        name: { $regex: new RegExp(`^${name}$`, 'i') } // case-insensitive match
      });
  
      if (existing) {
        return warningResponse(res, "Category with this name already exists.", {}, 409);
      }
  
      const category = new Category({
        company_id: user._id,
        name,
        type,
        status
      });
  
      await category.save();
  
      return successResponse(res, "Category created successfully!", category);
    } catch (err) {
      return errorResponse(res, "Failed to create category", err, 500);
    }
  };
  

  const putCategoryAPI = async (req, res, next) => {
    try {
      const { name, status, type } = req.body;
      const user = req.user;
  
      if (!name || typeof status === 'undefined') {
        return warningResponse(res, "Name, type and status are required fields.", {}, 400);
      }

      const category = await Category.findOne({ company_id: user._id, _id: req.params.id });
      if (!category) {
        return warningResponse(res, "Category not found.", {}, 404);
      }
  
      const duplicate = await Category.findOne({
        company_id: user._id,
        type: type,
        name: { $regex: new RegExp(`^${name}$`, 'i') },
        _id: { $ne: req.params.id }
      });
  
      if (duplicate) {
        return warningResponse(res, "Another category with this name already exists.", {}, 409);
      }
  
      category.name = name;
      category.type = type;
      category.status = status;
      await category.save();
  
      return successResponse(res, "Category updated successfully!", category);
    } catch (err) {
      return errorResponse(res, "Failed to update category", err, 500);
    }
  };
  

const deleteCategoryAPI = async (req, res, next) => {
    try {
        const user = req.user;
        const categoryId = req.params.id;
        const category = await Category.findOne({ company_id: user._id, _id: categoryId });
        if (!category) {
            return warningResponse(res, "Category not found.", {}, 404);
        }
        await category.deleteOne();
        return successResponse(res, "Category deleted successfully!", {}, 200);
    } catch (err) {
        return errorResponse(res, "Failed to delete category", err, 500);
    }
};

module.exports = {
    getCategoryAPI,
    postCategoryAPI,
    putCategoryAPI,
    deleteCategoryAPI,
};
