const User = require('../../model/User');
const Zone = require('../../model/Zone');
const validation = require('../../util/validation')

exports.getRegionAPI = async (req, res, next) => {
    const userId = req.userId;
    const zone = await Zone.find({ created_by: userId });
    let allRegions = [];
    zone.forEach(item => {
        item.region.forEach(data => {
            allRegions.push(data);
        })
    })

    res.status(200).json({
        status: "Success",
        statusCode: 200,
        message: "Data fetched successfully!",
        data: allRegions,
    })

}

exports.createRegionAPI = async (req, res, next) => {
    try {
        const data = await Zone.find({ created_by: userId }).select('id name');
        res.status(200).json({
            status: "Success",
            statusCode: 200,
            message: "Data fetched successfully",
            data
        })
    } catch (error) {
        next(error);
    }
}

exports.postRegionAPI = async (req, res, next) => {
    try {
        if (!validation(req, res)) return;

        const { region, zone_id } = req.body;
        const userId = req.userId;

        const zone = await Zone.findOne({ created_by: userId, _id: zone_id });

        if (!zone) {
            return res.status(404).json({
                status: "Fail",
                statusCode: 404,
                message: "Zone not found or not authorized."
            });
        }

        res.status(200).json({
            region,
            zone_id
        });

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                status: "Fail",
                statusCode: 404,
                message: "User not found."
            });
        }

        let regions = [];

        if (Array.isArray(region) && region.length > 0) {
            for (const item of region) {
                regions.push({
                    name: item.name,
                    created_by: userId,
                    company_id: user.company_id,
                    master_company_id: user.master_company_id,
                    parent_company_id: user.parent_company_id
                });
            }
        }

        await zone.addRegion(regions);

        res.status(200).json({
            status: "Success",
            statusCode: 200,
            message: 'Regions added successfully!',
        });

    } catch (error) {
        console.error("Error occurred:", error);
        res.status(500).json({
            status: "Error",
            statusCode: 500,
            message: "Internal server error"
        });
    }
};

exports.postRegionDataAPI = (req, res, next) => {
    try {
        const userId = req.userId;
    } catch (error) {
        next(error);
    }
}
