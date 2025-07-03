const zone = require('../../model/Zone');
const { errorResponse, successResponse } = require('../../util/response');
const mongoose = require('mongoose');
const { Types } = mongoose;

exports.getBranchAPI = async (req, res, next) => {
    try {
        const userId = req.userId;
        const Zone = await zone.find({ created_by: userId });

        if (!Zone) {
            return errorResponse(res, "Zone does not exist", {}, 404)
        }

        let allBranch = [];
        Zone.forEach(item => {
            item.region.forEach(data => {
                data.branch.forEach(val => {
                    allBranch.push({ data: val, regionId: data._id });
                })
            })
        })

        return successResponse(res, "Zone fetched successfully", allBranch)

    } catch (error) {
        next(error);
    }
}

exports.postRegionBranchAPI = async (req, res, next) => {
    try {
        const userId = req.userId;
        const regionId = req.params.regionId;
        const { branch } = req.body;

        if (!branch || (Array.isArray(branch) && branch.length === 0)) {
            return errorResponse(res, "No branch data provided", {}, 400);
        }

        const Zone = await zone.findOne({
            region: {
                $elemMatch: {
                    _id: regionId
                }
            },
            created_by: Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : userId
        });

        if (!Zone) {
            return errorResponse(res, "Zone does not exist", {}, 404);
        }

        const matchedRegion = Zone.region.find(item =>
            item._id?.toString() === regionId.toString()
        );

        if (!matchedRegion) {
            return errorResponse(res, "Region does not exist", {}, 404);
        }

        if (!Array.isArray(matchedRegion.branch)) {
            matchedRegion.branch = [];
        }

        const incomingBranches = Array.isArray(branch) ? branch : [branch];

        // Prepare a map of incoming branches by ID (if present)
        const incomingBranchIdSet = new Set(
            incomingBranches
                .filter(b => b.branchId)
                .map(b => b.branchId.toString())
        );

        // Update or add incoming branches
        for (const item of incomingBranches) {
            if (item.branchId) {
                const existing = matchedRegion.branch.find(
                    b => b._id?.toString() === item.branchId.toString()
                );
                if (existing) {
                    existing.name = item.name;
                    existing.code = item.code || '';
                } else {
                    matchedRegion.branch.push({
                        _id: new Types.ObjectId(item.branchId), // optional
                        name: item.name,
                        code: item.code || ''
                    });
                }
            } else {
                matchedRegion.branch.push({
                    name: item.name,
                    code: item.code || ''
                });
            }
        }

        if (incomingBranchIdSet.size > 0) {
            matchedRegion.branch = matchedRegion.branch.filter(b => {
                return !b._id || incomingBranchIdSet.has(b._id.toString());
            });
        }

        await Zone.save();

        return successResponse(res, "Branches saved successfully");
    } catch (error) {
        next(error);
    }
};

exports.postBranchAPI = async (req, res, next) => {
    try {
        const userId = req.userId;

        const { name, code, regionId } = req.body;

        const Zone = await zone.findOne({
            region: {
                $elemMatch: {
                    _id: regionId
                }
            },
            created_by: userId
        })

        if (!Zone) {
            return errorResponse(res, "Zone does not exist")
        }

        const region = Zone.region || [];

        const matchedRegion = region.find(item =>
            item._id.toString().trim() === regionId.toString().trim()
        );

        if (!matchedRegion) {
            return errorResponse(res, "Region does not exist", {}, 404)
        }

        const matchedBranch = matchedRegion.branch;

        matchedBranch.push({
            name,
            code,
            status: true
        });

        await Zone.save();

        return successResponse(res, "Branches saved successfully");

    } catch (error) {
        next(error)
    }
}

exports.putBranchUpdateAPI = async (req, res, next) => {
    try {
        const userId = req.userId;
        const branchId = req.params.branchId;

        const objectIdBranchId = mongoose.Types.ObjectId.isValid(branchId)
            ? new mongoose.Types.ObjectId(branchId)
            : branchId;

        const { name, code, regionId } = req.body;

        // Step 1: Find the branch via aggregation
        const result = await zone.aggregate([
            { $unwind: "$region" },
            { $unwind: "$region.branch" },
            {
                $match: {
                    "region.branch._id": objectIdBranchId
                }
            },
            {
                $project: {
                    zone_id: "$_id",
                    region_id: "$region._id",
                    branch: "$region.branch"
                }
            }
        ]);

        if (result.length === 0) {
            return res.status(404).json({ status: "Failure", message: "Branch not found" });
        }

        const foundData = result[0];
        const foundRegionId = foundData.region_id.toString().trim();

        if (foundRegionId === regionId.toString().trim()) {

            await zone.updateOne(
                {
                    "region._id": new mongoose.Types.ObjectId(regionId),
                    "region.branch._id": objectIdBranchId
                },
                {
                    $set: {
                        "region.$[regionElem].branch.$[branchElem].name": name,
                        "region.$[regionElem].branch.$[branchElem].code": code
                    }
                },
                {
                    arrayFilters: [
                        { "regionElem._id": new mongoose.Types.ObjectId(regionId) },
                        { "branchElem._id": objectIdBranchId }
                    ]
                }
            );
        } else {

            const updatedBranch = {
                _id: objectIdBranchId,
                name,
                code
            };

            // Remove from old region
            await zone.updateOne(
                {
                    "region._id": new mongoose.Types.ObjectId(foundRegionId)
                },
                {
                    $pull: {
                        "region.$.branch": { _id: objectIdBranchId }
                    }
                }
            );

            // Add to new region
            await zone.updateOne(
                {
                    "region._id": new mongoose.Types.ObjectId(regionId)
                },
                {
                    $push: {
                        "region.$.branch": updatedBranch
                    }
                }
            );
        }

        return successResponse(res, "Branch updated successfully")

    } catch (error) {
        next(error)
    }
}

exports.postBranchUniqueCheck = async (req, res, next) => {
    try {
        const userId = req.userId;
        const datas = req.body;

        const Zone = await zone.findOne({ created_by: userId });

        let allBranch = [];

        if (Zone?.region?.length) {
            allBranch = Zone.region.flatMap(region =>
                Array.isArray(region.branch)
                    ? region.branch.map(branch => branch)
                    : []
            );
        }

        const matchedNameIndexes = new Set();
        const matchedCodeIndexes = new Set();

        datas.forEach((input, index) => {
            const inputName = input.name?.toString().trim().toLowerCase();
            const inputCode = input.code?.toString().trim().toLowerCase();
            const inputId = input.branchId;

            for (const branch of allBranch) {
                const branchId = branch._id?.toString();

                if (branchId === inputId) continue;

                const branchName = branch.name?.toString().trim().toLowerCase();
                const branchCode = branch.code?.toString().trim().toLowerCase();

                if (inputName && branchName === inputName) {
                    matchedNameIndexes.add(index);
                }

                if (inputCode && branchCode === inputCode) {
                    matchedCodeIndexes.add(index);
                }
            }
        });

        const nameCheck = matchedNameIndexes.size > 0;
        const codeCheck = matchedCodeIndexes.size > 0;

        res.status(200).json({
            nameCheck,
            codeCheck,
            matchedNameIndexes: Array.from(matchedNameIndexes).sort((a, b) => a - b),
            matchedCodeIndexes: Array.from(matchedCodeIndexes).sort((a, b) => a - b),
        });

    } catch (error) {
        console.error("Unique check error:", error);
        next(error);
    }
};


