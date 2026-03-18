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

        if (channelId !== '' && channelId !== 'null' && channelId !== null) {

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
        const channel_id = req.params.channelId; // main channel _id
        const { name, status, channelId, id } = req.body; // channelId = new parent channel, id = subchannel _id

        if (channelId && channelId !== '') {
            // Sub-channel logic
            if (channel_id.toString() === channelId.toString()) {
                // Same parent, just update subchannel details
                await Channel.findOneAndUpdate(
                    { 'sub_channels._id': id },
                    {
                        $set: {
                            'sub_channels.$.name': name,
                            'sub_channels.$.status': status
                        }
                    }
                );
            } else {
                // Move subchannel from old to new parent
                await Channel.findOneAndUpdate(
                    { 'sub_channels._id': id },
                    { $pull: { sub_channels: { _id: id } } }
                );

                await Channel.findByIdAndUpdate(channelId, {
                    $push: {
                        sub_channels: {
                            _id: id,
                            name,
                            status,
                            created_by: userId,
                            company_id: userId
                        }
                    }
                });
            }
        } else {
            // Normal parent channel update
            await Channel.findOneAndUpdate(
                { _id: id, created_by: userId },
                { name, status }
            );
        }

        return successResponse(res, "Channel updated successfully");
    } catch (error) {
        next(error);
    }
};
