const config = require('./config.json');
const request = require("request-promise")

const LINE_MESSAGING_API = "https://api.line.me/v2/bot/message"
const LINE_HEADER = {
    "Content-Type": "application/json",
    "Authorization": "Bearer " + config.channelAccessToken
}

//--- Push message function ---//
exports.push = (userId, msg, quickItems) => {
    return request.post({
        headers: LINE_HEADER,
        uri: `${LINE_MESSAGING_API}/push`,
        body: JSON.stringify({
            to: userId,
            messages: [{ type: "text", text: msg, quickReply: quickItems }]
        })
    })
}

//--- Reply message function ---//
exports.reply = (token, payload) => {
    return request.post({
        uri: `${LINE_MESSAGING_API}/reply`,
        headers: LINE_HEADER,
        body: JSON.stringify({
            replyToken: token,
            messages: [payload]
        })
    })
}

//--- Broadcast message function ---//
exports.broadcast = (msg) => {
    return request.post({
        uri: `${LINE_MESSAGING_API}/broadcast`,
        headers: LINE_HEADER,
        body: JSON.stringify({
            messages: [{ type: "text", text: msg }]
        })
    })
}

//--- Postback action ---//
exports.PostBackAction = (event, msg, items) => {
    let itemList = []

    items.forEach(api => {
        itemList.push({
            type: 'action',
            action: {
                type: 'postback',
                label: api,
                data: `api=${api}&userid=${event.source.userId}`,
                displayText: api
            }
        })
    })

    this.push(event.source.userId, msg, { items: itemList })
}

//--- Camera & Cameraroll action ---//
exports.CameraAction = (event, msg) => {
    let items = [
        {
            type: 'action',
            action: {
                type: 'camera',
                label: 'Camera'
            }
        }, {
            type: 'action',
            action: {
                type: 'cameraRoll',
                label: 'Gallery'
            }
        }]

    this.push(event.source.userId, msg, { items: items })
}

//--- Flex container structure ---//
exports.getFlexStructure = (title, alt, mainContents) => {
    return {
        type: "flex",
        altText: alt,
        contents: {
            type: "bubble",
            body: {
                type: "box",
                layout: "vertical",
                contents: [
                    {
                        type: "text",
                        text: title,
                        weight: "bold",
                        size: "xl"
                    },
                    {
                        type: "box",
                        layout: "vertical",
                        margin: "lg",
                        spacing: "sm",
                        contents: mainContents
                    }
                ]
            }
        }
    }
}