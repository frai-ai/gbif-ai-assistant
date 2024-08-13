const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const url = require('url');
const sharp = require('sharp');
const fs = require('fs');
const metric = require('./metric');

require('dotenv').config(); // Load environment variables from .env file
console.log(process.env) 

const FormData = require('form-data');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

const whatsappAPIUrl = process.env.WSP_API_URL;
const token = process.env.WSP_TOKEN
const API_KEY = process.env.OPENAI_API_KEY
const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN

app.get('/', (req, res) => {
    res.send('Hello, World! GBIF');
});


app.get('/webhook', (req, res) => {
    const VERIFY_TOKEN = 'hellorest';

    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    } else {
        console.log("no mode sent");
    }

});

// Define a class for the objects
class Contact {
    constructor(number, step, data = new Map()) {
      this.step = step;
      this.number = number;
      this.data = data instanceof Map ? data : new Map(data);
    }
    
    // Example method to add data to the map
    addData(key, value) {
      this.data.set(key, value);
    }
  
    // Example method to get data from the map
    getData(key) {
      return this.data.get(key);
    }
  }

const contactsArray = new Map();
const debugging = false;

// Endpoint to handle incoming messages
app.post('/webhook', async (req, res) => {
    const message = req.body;

    // Log the incoming message
    // console.log('Received message:', JSON.stringify(message, null, 2));

    // Process the incoming message as needed
    // For example, you can send an automated reply

    // Check if the message is a text message
    if (message.entry && message.entry[0].changes && message.entry[0].changes[0].value.messages && message.entry[0].changes[0].value.messages[0].text) {
        const from = message.entry[0].changes[0].value.messages[0].from;
        const msgBody = message.entry[0].changes[0].value.messages[0].text.body;

        if (typeof msgBody === 'undefined' || msgBody === null || msgBody === '') {
            // The variable is undefined, null, or an empty string
          }else{
       
        var currentContact;

        if( contactsArray.has(from)){
            currentContact= contactsArray.get(from)
        }else{
            currentContact = new Contact(from,0)
            contactsArray.set(from,currentContact)
        }

        currentContact.step = currentContact.step+1;
        contactsArray.set(from,currentContact)

        if(debugging){whatsappReply(currentContact.number, "------DEBUG------  Current Step:"+currentContact.step)}

        switch (currentContact.step) {
            case 1:
                whatsappReply(currentContact.number, "Hi, I'm the GBIF AI assistant. I'll help you find insights about data occurrences from www.gbif.org related to a specific taxon. Please feel free to ask me anything related to a scientific name or a common name, and I'll retrieve some interesting metrics about biodiversity data.")
                
                break;
            case 2:

                currentContact.addData("initalRequest",msgBody)

                const currentDate = new Date();

                if(debugging){whatsappReply(currentContact.number, "------DEBUG------  su consulta fue:"+currentContact.getData("initalRequest"))}

                const requestData = {
                    model: "gpt-4o-2024-08-06", // You can choose other models if you have access
                    messages:[
                       { role:"system",
                        content:`You are a helpful biodiversity data expert i will give you a request, 
                                try to find the taxon name on the request, if given request has common name
                                or scientific name change to the taxon name strictly, 
                                only respond the parameters detected in the original request but always add the taxon name,
                                can add Other common known names from your records
                                the current date is: `+currentDate
                        },
                        { role:"user",
                        content:"request:"+
                        currentContact.getData("initalRequest")+
                        `
                        `
                        },
                        
                    ],
                    response_format: {
                        type: "json_schema",
                        json_schema: {
                            name: "gibif_query",
                            strict: false,
                            schema: {
                                type: "object",
                                properties: {
                                    taxon_name: { type: "string" },
                                    basisOfRecord: {
                                        type: "string",
                                        enum: ["PRESERVED_SPECIMEN", "FOSSIL_SPECIMEN", "LIVING_SPECIMEN", "HUMAN_OBSERVATION", "MACHINE_OBSERVATION", "MATERIAL_CITATION", "OCCURRENCE"]
                                    },
                                    continent: {
                                        type: "string",
                                        enum: ["AFRICA", "ANTARCTICA", "ASIA", "OCEANIA", "EUROPE", "NORTH_AMERICA", "SOUTH_AMERICA"]
                                    },
                                    publishingCountry: { type: "string",
                                        description: "2-letter country code as per ISO-3166-1"   },
                                    country: {
                                    type: "string",
                                    description: "2-letter country code as per ISO-3166-1"},
                                    eventDate: { type: "array", items: { type: "string", format: "date", description: "Occurrence date in ISO 8601 format: yyyy, yyyy-MM or yyyy-MM-dd" } },
                                    typeStatus: {
                                        type: "string",
                                        enum: ["TYPE", "TYPE_SPECIES", "TYPE_GENUS", "ALLOLECTOTYPE", "ALLONEOTYPE", "ALLOTYPE", "COTYPE", "EPITYPE", "EXEPITYPE", "EXHOLOTYPE", "EXISOTYPE", "EXLECTOTYPE", "EXNEOTYPE", "EXPARATYPE", "EXSYNTYPE", "EXTYPE", "HAPANTOTYPE", "HOLOTYPE", "HYPOTYPE", "ICONOTYPE", "ISOLECTOTYPE", "ISONEOTYPE", "ISOPARATYPE", "ISOSYNTYPE", "ISOTYPE", "LECTOTYPE", "NEOTYPE", "NOTATYPE", "ORIGINALMATERIAL", "PARALECTOTYPE", "PARANEOTYPE", "PARATYPE", "PLASTOHOLOTYPE", "PLASTOISOTYPE", "PLASTOLECTOTYPE", "PLASTONEOTYPE", "PLASTOPARATYPE", "PLASTOSYNTYPE", "PLASTOTYPE", "PLESIOTYPE", "SECONDARYTYPE", "SUPPLEMENTARYTYPE", "SYNTYPE", "TOPOTYPE"]
                                    },
                                    otherKnownNames: { type: "array", items: { type: "string", description: "Other common known names in diferent languages" } },
                                },
                                required: ["taxon_name"],
                                additionalProperties: true
                            }
                        }
                    },                    
                    max_tokens: 300,
                    temperature: 0.2
                };

                openAICall(requestData).then(taxon => {

                    if(debugging){ whatsappReply(currentContact.number, "------DEBUG------  your taxon:"+taxon)}

                    var result=  JSON.parse(taxon);
                    if (typeof result.taxon_name !== "undefined" && result.taxon_name !== "") {
                    
                        if(debugging){console.log(result)}
                    
                    if (typeof result.otherKnownNames !== "undefined") {
                        if(result.otherKnownNames.length >0){
                            whatsappReply(currentContact.number,  "*"+result.taxon_name+"* \n\nOther known names: \n"+result.otherKnownNames.map(element => `${element}`).join(', '))
                        }
                    }

                    delete result.otherKnownNames

                        
                   

                    gbifRequest("https://api.gbif.org/v1/species/search?q="+encodeURIComponent(result.taxon_name)).then(taxonResult => {

                       var taxonObtained = taxonResult.results[0]

                       // console.log(JSON.stringify(taxonResult.results[0]))

                       //whatsappReply(currentContact.number, "*"+result.taxon_name+"*")

                      // if(debugging){ whatsappReply(currentContact.number, "your taxon repsonse:"+JSON.stringify(taxonResult.results[0]))}


                        if (typeof taxonObtained.nubKey !== "undefined" && taxonObtained.nubKey !== "") {

                            const taxon_name = result.taxon_name

                            delete result.taxon_name

                            result.taxonKey = taxonObtained.nubKey

                            const getUrl = buildGetUrl("https://api.gbif.org/v1/occurrence/search?", result);

                            console.log(getUrl);

                            if(debugging){ whatsappReply(currentContact.number, "------DEBUG------  url:"+getUrl)}

                            whatsappReply(currentContact.number,"Searching and parsing results... \nThis should take a moment while I analyze your request.")

                            metric.metrics(getUrl).then(results => {

                            if(results){
                              
                              if(results.firstMedia && results.firstMedia.identifier!=''){
                                
                                whatsappSendImage(currentContact.number,results.firstMedia.identifier,`This image, created by ${results.firstMedia.creator} and published by ${results.firstMedia.publisher} on ${new Date(results.firstMedia.created).toDateString()}, is licensed under the ${results.firstMedia.licenseName}. `)
                                
                              }

                              if(results.coordinates.length >0){

                                  const latlngArray = results.coordinates
                                  
                                
                                  const maxResults = 100;
                                  const limitedLatLngs = latlngArray.slice(0, maxResults);
                                  const markers = limitedLatLngs.map(coords => `pin-s-marker${coords}`).join(',');

                                  const centerLng = (results.minLng + results.maxLng) / 2;
                                  const centerLat = (results.minLat + results.maxLat) / 2;


                                  const latDiff = results.maxLat - results.minLat;
                                  const lngDiff = results.maxLng - results.minLng;
                                  const maxDiff = Math.max(latDiff, lngDiff);
                                  
                                  let zoom;
                                  if (maxDiff > 60) {
                                      zoom = 1; // World view
                                  } else if (maxDiff > 30) {
                                      zoom = 3;
                                  } else if (maxDiff > 10) {
                                      zoom = 5;
                                  } else if (maxDiff > 5) {
                                      zoom = 7;
                                  } else if (maxDiff > 1) {
                                      zoom = 10;
                                  } else {
                                      zoom = 12; // Close view
                                  }

                                  const url = `https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/static/${markers}/${centerLng},${centerLat},${zoom}/800x600?access_token=${MAPBOX_TOKEN}`;

                                  console.log(url);

                                 

                                  const locationMap =  results.top10UniqueLocations.reduce((map, location) => {
                                    const key = `${location.country}, ${location.stateProvince}`;
                                    map[key] = location.count;
                                    return map;
                                  }, {});
                                  
                                  // Display the map as a string
                                  const locationMapStr = Object.entries(locationMap)
                                    .map(([key, value]) => `- ${key}: ${value}\n`)
                                    .join('');
                                  


                                  whatsappSendImage(currentContact.number,url,
                                    `*Map Occurrences of ${taxon_name}*:`+latlngArray.length+"\nTop 10 locations:\n"+`${locationMapStr}`)
                                  if (Object.keys(results.occurrencesPerMonth).length > 1){
                                    whatsappSendImage(currentContact.number,results.occurrencesPerMonthChartUrl,
                                        `*Distribution of the published data acroos the year*`)
                                  }
                                  if (Object.keys(results.occurrencesPerYear).length > 1){
                                    whatsappSendImage(currentContact.number,results.occurrencesPerYearChartUrl,
                                        `*Yearly count of published data during time*`)
                                  }
                              }

                              delete results.coordinates
                              delete results.maxLat
                              delete results.maxLng
                              delete results.minLat
                              delete results.minLng
                              delete results.firstMedia
                              delete results.occurrencesPerMonth
                              delete results.occurrencesPerMonthChartUrl
                              delete results.occurrencesPerYear
                              delete results.occurrencesPerYearChartUrl
                              delete results.top10UniqueLocations
                              delete results.occurrencesPerIssues
                            }

                              const requestData = {
                                model: "gpt-4o", // You can choose other models if you have access
                                messages:[
                                   { role:"system",
                                    content:`Forget anyYou are a helpful biodiversity data expert.
                                             I will give a json response from a data request
                                             please resume the data according to the original question. 
                                             Add some format to send througth Whatsapp, 
                                             titles in bold as "*title*".
                                             Bulleted items doesn't need to be bold.
                                             Mention that the results are based in number of retrievedRecords 
                                             but there is a totalRecords for that search that can be found in web search.
                                             if licenses are mentioned in the original question, 
                                             include occurrencesPerLicense information otherwise don't mention it
                                             if occurrences issues are mentioned in the original question, 
                                             include occurrencesPerIssues information otherwise don't mention it.
                                             `
                                    },
                                    { role:"user",
                                    content:
                                    `reply en English or according to the original question: "${currentContact.getData("initalRequest")}" JSON response obtained: ${JSON.stringify(results)}`
                                    },
                                    
                                ],
                                max_tokens: 450,
                                temperature: 0.5
                            };
                    
                            if(debugging){console.log(requestData)}

                            logUserQuestions(currentContact.number, currentContact.getData("initalRequest"))
                        

                            openAICall(requestData)
                            .then(async (OpenAIresponse) => {

                                    await whatsappReply(currentContact.number,OpenAIresponse)



                                    whatsappReply(currentContact.number,`Those are the insights of your request, for further information please visit www.gbif.org or say "hello" for a new request`)
                                    currentContact.step = 0;
                                    contactsArray.set(currentContact.number,currentContact)

                            });
                              

                              
                           }) .catch((error) => {
                            // Handle error
                            console.error("An error occurred:", error);

                            if(debugging){ whatsappReply(currentContact.number, "------DEBUG------ error:"+error)}

                            errorMessage(currentContact.number,currentContact)
                          });

                           


                        }else{
                            errorMessage(currentContact.number,currentContact)
                        }

                       



                    });

                    }else{

                        errorMessage(currentContact.number,currentContact)
                        
                    
                    }
                    


              

                })


         
                //RESET AFTER RESPONSE

                break;

            default:
                errorMessage(from,currentContact)
                break;
        }

    }

    }


    res.sendStatus(200);
});

async function logUserQuestions(user, question) {

    // Data to be appended to the file
    const data = `\n${user}\t${question.replaceAll('\n', ' ').replaceAll('\t', ' ')}`;

    // Append data to a file asynchronously
    fs.appendFile('user_log.csv', data, 'utf8', (err) => {
        if (err) {
            console.error('Error appending to file:', err);
        } else {
            console.log('Data has been appended successfully');
        }
    });
}

function buildGetUrl(endpoint, params) {
    const queryObject = {};
  
    // Iterate over each key-value pair in the params object
    for (const key in params) {
      if (params.hasOwnProperty(key)) {
        if (Array.isArray(params[key])) {
          // Handle array parameters
          queryObject[key] = params[key].join(',');
        } else {
          queryObject[key] = params[key];
        }
      }
    }
  
    // Parse the endpoint to a URL object
    const parsedUrl = url.parse(endpoint, true);
  
    // Merge existing query parameters with the new ones
    const mergedQuery = { ...parsedUrl.query, ...queryObject };
  
    // Rebuild the URL with the merged query parameters
    parsedUrl.search = null; // Set search to null to rebuild the query string
    parsedUrl.query = mergedQuery;
  
    // Return the formatted URL
    return url.format(parsedUrl);
  }

function errorMessage(to,currentContact){

    currentContact.step = 0;
    contactsArray.set(to,currentContact)

    whatsappReply(to, `I'm sorry, there was an error processing your request, please start again by saying "hello"`)
}

async function gbifRequest(requestUrl) {
    console.log(requestUrl)
    return await new Promise((resolve, reject) => {
      axios.get(requestUrl,  {
        headers: {
          'Content-Type': 'application/json'
        }
      })
        .then(response => {
          resolve(response.data);
        })
        .catch(error => {
          console.error('Error from GBIF:', error.response ? error.response.data : error.message);
          reject('An error occurred while making the request');
        });
    });
  }

async function openAICall(requestData) {
    return await new Promise((resolve, reject) => {
      axios.post('https://api.openai.com/v1/chat/completions', requestData, {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        }
      })
        .then(response => {
          resolve(response.data.choices[0].message.content);
        })
        .catch(error => {
          console.error('Error from OpenAI:', error.response ? error.response.data : error.message);
          reject('An error occurred while making the request');
        });
    });
  }


 
  async function whatsappReply(from, replyMessage) {
    try {
        const response = await axios.post(whatsappAPIUrl, {
            messaging_product: 'whatsapp',
            to: from,
            type: 'text',
            text: { body: replyMessage }
        }, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        // You can log the response if needed
        // console.log('Message sent:', replyMessage);
        return response.data;
    } catch (error) {
        console.error('Error sending message:', error);
        throw error; // Re-throw the error to handle it in the calling code if necessary
    }
}



async function uploadMediaToMeta(inputBuffer) {
  try {
      const form = new FormData();
      // Append the buffer as a file with a filename
      form.append('file', inputBuffer, 'image.jpeg');
      // Append the messaging product type and content type
      form.append('messaging_product', 'whatsapp');
      form.append('type', 'image/jpeg');

      const response = await axios.post(`https://graph.facebook.com/v19.0/316390658224354/media`, form, {
          headers: {
              'Authorization': `Bearer ${token}`,
              ...form.getHeaders() // Necessary to include the correct headers for FormData
          }
      });

      return response.data.id;
  } catch (error) {
      console.error('Error uploading media:', error.response ? error.response.data : error.message);
      throw error;
  }
}

async function whatsappSendImage(from, imageUrl, caption = '') {
  try {
      // Step 1: Download the image as an arraybuffer
      const response = await axios({
          url: imageUrl,
          responseType: 'arraybuffer',
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          timeout: 20000 // 10 seconds
      });

      // Step 2: Convert the ArrayBuffer to a Buffer
      const inputBuffer = Buffer.from(response.data);

      // Step 3: Convert the image to JPEG on the fly using sharp
      const imageBuffer = await sharp(inputBuffer)
          .jpeg({ quality: 90 })
          .toBuffer();

      // Step 4: Upload the JPEG image to the Meta endpoint to get the media_id
      const mediaId = await uploadMediaToMeta(imageBuffer);

      // Step 5: Send the image via WhatsApp API using the media_id
      axios.post(whatsappAPIUrl, {
          messaging_product: 'whatsapp',
          to: from,
          type: 'image',
          image: {
              id: mediaId,
              caption: caption
          }
      }, {
          headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
          }
      }).then(response => {
          console.log('Image sent successfully');
      }).catch(error => {
          console.error('Error sending image:', error);
      });

  } catch (error) {
      console.error('Error in whatsappSendImage:', error);
  }
}

// Endpoint to send messages
app.post('/send-message', async (req, res) => {
    const { phone, message } = req.body;

    try {
        const response = await axios.post(whatsappAPIUrl, {
            messaging_product: 'whatsapp',
            to: phone,
            type: 'text',
            text: { body: message }
        }, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        res.json(response.data);
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

