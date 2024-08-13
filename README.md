# Gibif AI Assistant

Gibif AI Assistant is an AI-powered tool that leverages Natural Language Processing (NLP) to allow users to query the Global Biodiversity Information Facility (GBIF) API through WhatsApp. By integrating NLP with the popular messaging platform, Gibif AI Assistant offers a simple, conversational way to access detailed biodiversity information.

## Features

- **Conversational AI:** The assistant interprets user queries in natural language and translates them into structured queries for the GBIF API.
- **Biodiversity Insights:** Provides users with insights on species occurrences, including data distribution by month, basis of record, data issues, licenses, conservation statuses, key locations, important datasets, and notable data recorders.
- **Media Integration:** Enhances user engagement by displaying available media, such as images, to provide a more immersive and informative experience.
- **Multi-Language Support:** The assistant supports queries in multiple languages, making biodiversity data accessible to a broader audience.

## Installation

1. **Navigate to the project directory:**

   cd gibif-ai-assistant

2. **Install the dependencies:**

   npm install

3. **Create a `.env` file in the root directory and add your API keys and tokens:**

   WSP_API_URL=your_whatsapp_api_url  
   WSP_TOKEN=your_whatsapp_token  
   OPENAI_API_KEY=your_openai_api_key  
   MAPBOX_TOKEN=your_mapbox_token  
   PORT=3000

## Usage

1. **Start the server:**

   npm start

   The server will run on the port specified in the `.env` file. By default, it is set to `3000`.

2. Use WhatsApp to send queries about biodiversity data. The assistant will respond with relevant information and media content.

## Example Query

When you send a message like "Show me data about African elephants," the Gibif AI Assistant will:

- Identify "African elephants" as the taxon of interest.
- Query the GBIF API for species occurrences and related data.
- Generate a summary of the results, including a map showing species occurrence locations, images, and other pertinent information.

## API Endpoints

- `GET /`: Returns a welcome message.
- `GET /webhook`: Used for verifying the webhook with WhatsApp.
- `POST /webhook`: Handles incoming messages from WhatsApp.
- `POST /send-message`: Allows sending a custom message to a user via WhatsApp.

## Code Overview

- **`app.js`**: The main file containing the Express server setup and logic for handling WhatsApp messages.
- **`metric.js`**: A module responsible for processing data retrieved from the GBIF API.
- **`utils.js`**: Contains utility functions for making API calls, handling responses, and more.

## Contributing

Contributions are welcome! Please fork this repository and submit a pull request with your proposed changes.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- The GBIF API for providing access to vast biodiversity data.
- OpenAI for enabling natural language processing capabilities.
- Mapbox for providing the tools to generate dynamic maps.
