const Channel = require('../../model/Channel');
const { successResponse, errorResponse } = require('../../util/response');

exports.getChannelAPI = async (req, res, next) => {
    try {

        const userId = req.userId;

        const channels = await Channel.find({ created_by: userId })

        const flattenedData = [];

        channels.forEach((channel) => {
            // Push parent channel
            flattenedData.push({
                id: channel._id,
                name: channel.name,
                status: channel.status,
                type: "parent",
                parent: "",
                channelId: ''
            });

            // Push sub-channels
            channel.sub_channels?.forEach((sub) => {
                flattenedData.push({
                    id: sub._id,
                    name: sub.name,
                    status: sub.status,
                    parent: channel.name,
                    type: "child",
                    channelId: channel._id
                });
            });
        });

        return successResponse(res, "Channel fetched successfully", flattenedData)
    } catch (error) {
        next(error)
    }
}

exports.postChannelAPI = async (req, res, next) => {
    try {

        const { name, status, channelId } = req.body;

        const userId = req.userId;

        if (channelId !== '') {

            await Channel.findOneAndUpdate({ _id: channelId }, {
                $push: {
                    sub_channels: {
                        name,
                        status,
                        created_by: userId,
                        company_id: userId
                    }
                }
            })

        } else {

            await Channel.create({ name, status, created_by: userId, company_id: userId })
        }


        return successResponse(res, "Channel created successfully")

    } catch (error) {
        next(error)
    }
}

exports.putChannelAPI = async (req, res, next) => {
    try {

        const userId = req.userId;

        const channel_id = req.params.channelId;

        const { name, status, channelId, id } = req.body;

        if (channelId !== '') {

            if (channel_id.toString().trim() == channelId.toString().trim()) {

                await Channel.findOneAndUpdate(
                    { 'sub_channels._id': channelId },
                    {
                        $set: {
                            'sub_channels.$.name': name,
                            'sub_channels.$.status': status
                        }
                    },
                    { new: true } // optional: returns the updated document
                );

            } else {

                res.json(id)

                await Channel.findOneAndUpdate(
                    { 'sub_channels._id': id },
                    {
                        $pull: {
                            sub_channels: { _id: id }
                        }
                    }
                );

                // Step 2: Push the subchannel into the new channel (by channelId)
                await Channel.findByIdAndUpdate(
                    channelId,
                    {
                        $push: {
                            sub_channels: {
                                _id: id, // Use the same _id if you want to preserve it
                                name,
                                status,
                                created_by: userId,
                                company_id: userId
                            }
                        }
                    }
                );

            }

        } else {

            await Channel.findOneAndUpdate({ _id: channelId, created_by: userId }, { name, status })

        }

        return successResponse(res, "Channel updated successfully")

    } catch (error) {
        next(error);
    }
}