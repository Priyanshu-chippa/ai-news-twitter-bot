// index.js
require('dotenv').config(); // Load .env variables FIRST

const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");
const axios = require('axios');
const { TwitterApi } = require('twitter-api-v2'); // Using this now!

// --- Twitter Function (keep for later, commented out) ---
// This function is kept for testing or direct tweeting if needed later.
// For now, the main logic will use postNewsThreadToTwitter.
async function testPostTweet_Example() {
    console.log("Attempting to authenticate and post a single test tweet...");
    if (!process.env.TWITTER_API_KEY || !process.env.TWITTER_API_SECRET || !process.env.TWITTER_ACCESS_TOKEN || !process.env.TWITTER_ACCESS_TOKEN_SECRET) {
        console.error("Error: Twitter API credentials not found in .env file.");
        return;
    }
    try {
        const client = new TwitterApi({
            appKey: process.env.TWITTER_API_KEY,
            appSecret: process.env.TWITTER_API_SECRET,
            accessToken: process.env.TWITTER_ACCESS_TOKEN,
            accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
        });
        const rwClient = client.readWrite;
        const tweetText = 'Single test tweet successful! #NodeJSBot';
        const { data: createdTweet } = await rwClient.v2.tweet(tweetText);
        console.log("Single test tweet posted successfully! ID:", createdTweet.id, "Text:", createdTweet.text);
    } catch (error) {
        console.error("Error during single test tweet operation:", error);
    }
}
// testPostTweet_Example(); // Not calling this by default

// --- Function to Fetch HTML ---
async function fetchTechmemeHtml() {
    const url = "https://www.techmeme.com/";
    console.log(`Fetching HTML from ${url}...`);
    try {
        const response = await axios.get(url, {
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36" },
        });
        if (response.status === 200) {
            console.log("HTML fetched successfully!");
            return response.data; // This is the HTML string
        } else {
            console.error(`Failed to fetch HTML: Status code ${response.status}`);
            return null;
        }
    } catch (error) {
        console.error(`Error fetching HTML from ${url}:`, error.message);
        return null;
    }
} // THIS IS THE END OF fetchTechmemeHtml

// --- Function to Analyze HTML and get Structured JSON from Gemini ---
async function analyzeHtmlAndGetJsonFromGemini(htmlContent) { // THIS FUNCTION STARTS AROUND LINE 49
    if (!process.env.GEMINI_API_KEY) {
        console.error("Error: GEMINI_API_KEY not found in .env file.");
        return null;
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const modelName = "gemini-2.5-flash-preview-05-20"; // Using the confirmed working model
    
    console.log(`\nAttempting to get structured JSON news from Gemini (${modelName})...`);
    try {
        if (typeof htmlContent !== 'string') {
            console.error("HTML content is not a string.");
            return null;
        }

        const model = genAI.getGenerativeModel({ 
            model: modelName,
            safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            ],
            generationConfig: { // Request JSON output
                responseMimeType: "application/json",
            }
        });
        
        const prompt = `
Analyze the following HTML document, which is the Techmeme homepage.
Identify the top 2 or 3 most significant news items related to Artificial Intelligence (AI), Machine Learning (ML), Large Language Models (LLMs), or major AI company news.

For each news item, provide the following information:
1.  "headline": A concise and engaging headline for the news, preferably under 70 characters.
2.  "summary": A brief summary of the news, preferably under 150 characters.
3.  "link": The direct URL to the main article for this news item. Try to find the most direct link to the story, often linked from the Techmeme headline.
4.  "hashtags": An array of 2-3 relevant string hashtags (e.g., ["#AI", "#Google", "#OpenAI", "#Funding"]).

Return your response ONLY as a valid JSON array of objects. Each object in the array should represent one news item and must have the keys "headline", "summary", "link", and "hashtags".

Example of the desired JSON format:
[
  {
    "headline": "Example AI Breakthrough Announced",
    "summary": "A new AI model achieves state-of-the-art results on a key benchmark.",
    "link": "https://example.com/news/ai-breakthrough",
    "hashtags": ["#AI", "#MachineLearning", "#SOTA"]
  },
  {
    "headline": "Big Tech Invests in AI Ethics",
    "summary": "Major tech company pledges $100M towards responsible AI development.",
    "link": "https://example.com/news/ai-ethics-investment",
    "hashtags": ["#AIEthics", "#ResponsibleAI", "#BigTech"]
  }
]

Do not include any explanatory text before or after the JSON array. Just the JSON.

HTML DOCUMENT:
---BEGIN HTML---
${htmlContent}
---END HTML---
        `; // End of template literal for prompt

        console.log(`Sending prompt to Gemini for JSON output (HTML length: ${htmlContent.length})...`); // THIS IS AROUND LINE 107
        
        const generationResult = await model.generateContent(prompt); // AROUND LINE 109
        const response = generationResult.response; // AROUND LINE 110
        
        if (!response || typeof response.text !== 'function') { // AROUND LINE 112
            console.error("Gemini did not return a valid response structure for JSON.");
            if (generationResult?.response?.promptFeedback) { 
                 console.error("Prompt Feedback:", generationResult.response.promptFeedback);
            }
            return null;
        } // THIS CLOSES THE IF STATEMENT
        
        const jsonString = response.text();
        console.log("----------------------------------------------------");
        console.log("Gemini Raw JSON String Response:");
        console.log(jsonString);
        console.log("----------------------------------------------------");

        try {
            const parsedJson = JSON.parse(jsonString);
            console.log("\nSuccessfully parsed JSON from Gemini:");
            console.log(JSON.stringify(parsedJson, null, 2)); // Pretty print the JSON
            console.log("----------------------------------------------------");
            return parsedJson; // Return the parsed JavaScript object/array
        } catch (parseError) {
            console.error("\nError parsing JSON string from Gemini:", parseError.message);
            console.error("Gemini likely did not return valid JSON. Check the raw string response above.");
            return null;
        } // THIS CLOSES THE INNER TRY-CATCH FOR JSON.parse

    } catch (error) { // THIS IS THE CATCH FOR THE OUTER TRY BLOCK of analyzeHtmlAndGetJsonFromGemini
        console.error("Error during Gemini structured JSON operation:", error.message);
        if (error.response?.promptFeedback) { 
             console.error("Prompt Feedback:", error.response.promptFeedback);
        } else if (error.status && error.statusText) {
            console.error(`API Error: ${error.status} ${error.statusText}`);
        } else {
             console.error("Full error object:", error); 
        }
        return null;
    } // THIS CLOSES THE OUTER CATCH BLOCK
} // THIS IS THE END OF analyzeHtmlAndGetJsonFromGemini FUNCTION (AROUND LINE 146)

// --- Function to Post News Thread to Twitter ---
async function postNewsThreadToTwitter(newsItems) { // THIS FUNCTION STARTS AROUND LINE 149
    if (!newsItems || newsItems.length === 0) {
        console.log("No news items to post.");
        return;
    }

    console.log("\nAttempting to post news thread to Twitter...");
    if (!process.env.TWITTER_API_KEY || !process.env.TWITTER_API_SECRET || !process.env.TWITTER_ACCESS_TOKEN || !process.env.TWITTER_ACCESS_TOKEN_SECRET) {
        console.error("Error: Twitter API credentials not found in .env file for posting.");
        return;
    }

    try {
        const client = new TwitterApi({
            appKey: process.env.TWITTER_API_KEY,
            appSecret: process.env.TWITTER_API_SECRET,
            accessToken: process.env.TWITTER_ACCESS_TOKEN,
            accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
        });
        const rwClient = client.readWrite;

        let previousTweetId = null;

        // 1. Post Intro Tweet
        const introText = "🚀 Today's Top AI News & Insights! 🧵👇 #AINews #TechUpdate";
        console.log(`Posting intro: "${introText}"`);
        const { data: introTweet } = await rwClient.v2.tweet(introText);
        previousTweetId = introTweet.id;
        console.log(`Intro tweet posted. ID: ${previousTweetId}`);

        await new Promise(resolve => setTimeout(resolve, 2000)); // 2-second delay

        // 2. Post each news item
        for (let i = 0; i < newsItems.length; i++) {
            const item = newsItems[i];
            const hashtagString = item.hashtags.join(" ");
            
            let tweetText = `${item.headline}\n\n${item.summary}\n\n${item.link}\n\n${hashtagString}`;
            
            if (tweetText.length > 280) {
                const excess = tweetText.length - 280 + 3; 
                item.summary = item.summary.slice(0, -excess) + "..."; 
                tweetText = `${item.headline}\n\n${item.summary}\n\n${item.link}\n\n${hashtagString}`;
                 if (tweetText.length > 280) { 
                    tweetText = tweetText.substring(0, 277) + "...";
                 }
            }

            console.log(`Posting news item ${i + 1}: "${item.headline}"`);
            const { data: newsTweet } = await rwClient.v2.tweet(tweetText, {
                reply: { in_reply_to_tweet_id: previousTweetId }
            });
            previousTweetId = newsTweet.id;
            console.log(`News item ${i + 1} posted. ID: ${previousTweetId}`);
            
            if (i < newsItems.length - 1) { 
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        } // THIS CLOSES THE FOR LOOP

        await new Promise(resolve => setTimeout(resolve, 2000)); 

        // 3. Post Outro Tweet
        const outroText = "That's a wrap for today's AI highlights! Follow for more. 💡 #AICommunity";
        console.log(`Posting outro: "${outroText}"`);
        const { data: outroTweet } = await rwClient.v2.tweet(outroText, {
            reply: { in_reply_to_tweet_id: previousTweetId }
        });
        console.log(`Outro tweet posted. ID: ${outroTweet.id}`);
        
        console.log("\nNews thread posted successfully to Twitter!");

    } catch (error) { // THIS IS THE CATCH FOR postNewsThreadToTwitter
        console.error("\nError posting news thread to Twitter:");
        if (error.code === 401) { console.error("Unauthorized (401): Check Twitter API keys/permissions."); }
        else if (error.code === 403) { console.error("Forbidden (403): Possible rate limit, content issue, or app permission problem."); }
        if (error.data && error.data.errors) { console.error("API Error Details:", JSON.stringify(error.data.errors, null, 2)); }
        else if (error.data) { console.error("API Error Data:", JSON.stringify(error.data, null, 2)); }
        else { console.error("Full error object:", error); }
    } // THIS CLOSES THE CATCH BLOCK for postNewsThreadToTwitter
} // THIS IS THE END OF postNewsThreadToTwitter FUNCTION

// --- Main Bot Logic Orchestrator ---
async function mainBotLogic() { // THIS FUNCTION STARTS AROUND LINE 232
    console.log("--- Starting AI News Bot Cycle ---");
    const htmlContent = await fetchTechmemeHtml();

    if (htmlContent) {
        const structuredNewsData = await analyzeHtmlAndGetJsonFromGemini(htmlContent); 
        if (structuredNewsData && Array.isArray(structuredNewsData) && structuredNewsData.length > 0) {
            console.log(`\nSuccessfully received and parsed ${structuredNewsData.length} news items from Gemini.`);
            await postNewsThreadToTwitter(structuredNewsData); // Post the thread
        } else {
            console.log("\nFailed to get structured news data from Gemini, data is not an array, or no news items found.");
        }
    } else {
        console.log("\nFailed to fetch HTML content. Cannot proceed with this cycle.");
    } // THIS CLOSES THE IF (htmlContent) BLOCK
    console.log("\n--- AI News Bot Cycle Ended ---");
} // THIS IS THE END OF mainBotLogic FUNCTION

// --- Execution ---
mainBotLogic(); // THIS IS THE FINAL LINE