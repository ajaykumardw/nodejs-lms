const { default: mongoose } = require("mongoose");

const moduleBrandSchema = new mongoose.Schema({

}, {
    collection: "module_brand",
    timestamps: true
})

module.exports = mongoose.model("module_brand", moduleBrandSchema)