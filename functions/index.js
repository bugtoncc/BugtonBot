const functions = require('firebase-functions')
const request = require("request-promise")
const admin = require('firebase-admin')
admin.initializeApp()

const config = require('./config.json')
const lineapi = require('./lineapi.js')
const visionapi = require('./visionapi.js')

const region = 'asia-east2'
const runtimeOpts = {
    timeoutSeconds: 4,
    memory: "2GB"
}

const vision = require('@google-cloud/vision')
const client = new vision.ImageAnnotatorClient({
    keyFilename: 'Bugton bot-568826609fb8.json'
})

const LINE_MESSAGING_API = "https://api.line.me/v2/bot/message"
const LINE_HEADER = {
    "Content-Type": "application/json",
    "Authorization": "Bearer " + config.channelAccessToken
}


//--- webhook ---//
exports.webhook = functions.region(region).runWith(runtimeOpts)
    .https.onRequest(async (req, res) => {
        let event = req.body.events[0]

        if (event.type == 'message') {
            if (event.message.type == 'image') {
                processVision(event)
            } else if (event.message.type == 'text') {
                switch (event.message.text) {
                    case '!':
                        let itemArray = []
                        let items = ['userId', 'replyToken']

                        items.forEach(api => {
                            itemArray.push({
                                type: 'action',
                                action: {
                                    type: 'postback',
                                    label: api,
                                    data: `api=${api}&userid=${event.source.userId}`,
                                    displayText: api
                                }
                            })
                        })
                        lineapi.push(event.source.userId, 'what thing do you need to get?', { items: itemArray })
                        break;
                    case 'Vision':
                        // lineapi.reply(event.replyToken, { type: 'text', text: `Try uploading picture` })                   
                        // lineapi.PostBackAction(event, 'What category do you want to detect?',
                        //     [
                        //         visionapi.text.labels,
                        //         visionapi.text.objects,
                        //         visionapi.text.landmarks,
                        //         visionapi.text.logos,
                        //         visionapi.text.texts
                        //     ])
                        lineapi.CameraAction(event, 'Choose photo')
                        break;
                    case 'Thai NLP':
                        lineapi.reply(event.replyToken, { type: 'text', text: `Thai NLP not available now` })
                        break;
                    default:
                        lineapi.reply(event.replyToken, { type: 'text', text: `I don't understand, please try again` })
                }
            } else {
                // lineapi.reply(event.replyToken, lineapi.getFlexMessage())
            }
        } else if (event.type == 'postback') {
            // lineapi.reply(event.replyToken, { type: 'text', text: `Try upload photo` })
            // lineapi.reply(event.replyToken, { type: 'text', text: JSON.stringify(event) })
            // lineapi.reply(event.replyToken, { type: 'text', text: event.data.api })

            let item = event.postback.data.split('&')
            let postbackMessage = item[0].split('=')[1]
            let userId = item[1].split('=')[1]

            if (postbackMessage == visionapi.text.labels || postbackMessage == visionapi.text.objects || postbackMessage == visionapi.text.landmarks || postbackMessage == visionapi.text.logos || postbackMessage == visionapi.text.texts) {
                let fileName = `${userId}.jpg`
                let result

                switch (postbackMessage) {
                    case visionapi.text.labels:
                        [result] = await client.labelDetection(`gs://${config.bucketName}/${fileName}`)
                        showResult(event, visionapi.text.labels, result.labelAnnotations)
                        break

                    case visionapi.text.logos:
                        [result] = await client.logoDetection(`gs://${config.bucketName}/${fileName}`)
                        showResult(event, visionapi.text.logos, result.logoAnnotations)
                        break

                    case visionapi.text.landmarks:
                        [result] = await client.landmarkDetection(`gs://${config.bucketName}/${fileName}`)
                        showResult(event, visionapi.text.landmarks, result.landmarkAnnotations)
                        break

                    case visionapi.text.objects:
                        [result] = await client.objectLocalization(`gs://${config.bucketName}/${fileName}`)
                        showResult(event, visionapi.text.objects, result.localizedObjectAnnotations)
                        break

                    case visionapi.text.texts:
                        [result] = await client.textDetection(`gs://${config.bucketName}/${fileName}`)
                        showResult(event, visionapi.text.texts, result.textAnnotations)
                        break

                    case visionapi.text.faces:
                        [result] = await client.faceDetection(`gs://${config.bucketName}/${fileName}`)

                        let msg = ''
                        const faces = result.faceAnnotations;

                        // faces.forEach((face, i) => {
                        //     msg += `  Face #${i + 1}:`
                        //     msg += `    Joy: ${face.joyLikelihood}`
                        //     msg += `    Anger: ${face.angerLikelihood}`
                        //     msg += `    Sorrow: ${face.sorrowLikelihood}`
                        //     msg += `    Surprise: ${face.surpriseLikelihood}`
                        // });

                        console.log(faces)

                        lineapi.reply(event.replyToken, {
                            type: 'image',
                            originalContentUrl: `gs://${config.bucketName}/${fileName}`,
                            previewImageUrl: `gs://${config.bucketName}/${fileName}`
                        })

                        break
                    default:
                        // postback ==> '!'
                        if (postbackMessage == 'userId') {
                            lineapi.reply(event.replyToken, { type: 'text', text: event.source.userId })
                        } else if (postbackMessage == 'replyToken') {
                            lineapi.reply(event.replyToken, { type: 'text', text: event.replyToken })
                        }
                }
            } else {
                lineapi.reply(event.replyToken, { type: 'text', text: JSON.stringify(event) })
            }
        }

        return null
    })


const processVision = async (event) => {
    const path = require("path")
    const os = require("os")
    const fs = require("fs")

    let url = `${LINE_MESSAGING_API}/${event.message.id}/content`

    if (event.message.contentProvider.type === 'external') {
        url = event.message.contentProvider.originalContentUrl
    }

    let buffer = await request.get({
        headers: LINE_HEADER,
        uri: url,
        encoding: null
    })

    const tempLocalFile = path.join(os.tmpdir(), 'temp.jpg')
    await fs.writeFileSync(tempLocalFile, buffer)

    const bucket = admin.storage().bucket(`gs://${config.bucketName}/`)
    await bucket.upload(tempLocalFile, {
        destination: `${event.source.userId}.jpg`,
        metadata: { cacheControl: 'no-cache' }
    })
    fs.unlinkSync(tempLocalFile)

    // postback items
    lineapi.PostBackAction(event, 'What category do you want to detect?',
        [
            visionapi.text.labels,
            visionapi.text.objects,
            visionapi.text.landmarks,
            visionapi.text.logos,
            visionapi.text.texts
        ])
}

const showResult = async function (event, title, annotations) {
    // let i = 1
    // let msg = ''
    // annotations.forEach(label => {
    //     let description = label.description
    //     let score = label.score.toFixed(2)

    //     if (msg !== '') { msg = msg + '\n' }
    //     msg = msg + `${i}. ${description} - ${score}`
    //     i = i + 1
    // })
    // if (msg === '') { msg = "Result not found, try again." }
    //  lineapi.reply(event.replyToken, { type: 'text', text: msg })

    if (annotations.length == 0) {
        lineapi.reply(event.replyToken, { type: 'text', text: "Result not found, try again." })
        return
    }

    let flexContents = []
    annotations.forEach(label => {
        let name = (title == visionapi.text.objects ? label.name : label.description)
        let score = label.score.toFixed(2)

        let item = {
            type: "box",
            layout: "baseline",
            spacing: "sm",
            contents: [
                {
                    type: "text",
                    text: score,
                    color: "#aaaaaa",
                    size: "sm",
                    flex: 1
                },
                {
                    type: "text",
                    text: name,
                    wrap: true,
                    color: "#666666",
                    size: "sm",
                    flex: 5
                }
            ]
        }
        flexContents.push(item)
    })

    lineapi.reply(event.replyToken, lineapi.getFlexStructure(`${title} detected`, 'result', flexContents))
}
