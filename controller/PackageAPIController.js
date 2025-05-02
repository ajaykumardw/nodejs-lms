const validation = require('../validation/validation');
const PackageType = require('../model/PackageType');

exports.getPackageAPI = (req, res, next) => {

}

exports.createPackageAPI = (req, res, next) => {
    const userId = req.userId;
    PackageType.find({ created_by: userId })
        .select('id name')
        .then(result => {
            res.status(200).json({
                status: "Success",
                statusCode: 200,
                message: "Data fetched successfully!",
                data: result
            });
        }).catch(err => {
            next(err);
        })
}

exports.postPackageAPI = (req, res, next) => {
    const userId = req.userId;
    const { name, description, amount, packagetype, status } = req.body;
    res.status(200).json({
        name: name,
        description: description,
        amount: amount,
        packagetype: packagetype,
        status: status
    });
}

exports.putPackageAPI = (req, res, next) => {

}