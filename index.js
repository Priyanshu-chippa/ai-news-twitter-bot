// index.js
require('dotenv').config(); // Load .env variables FIRST

const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");
const axios = require('axios');
const { TwitterApi } = require('twitter-api-v2'); // Using this now!

// --- Twitter Function (Example - Not directly used by main logic now) ---
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
        const tweetText = 'Single test tweet successful! #NodeJSBot ' + new Date().toLocaleTimeString(); // Added time for uniqueness
        const { data: createdTweet } = await rwClient.v2.tweet(tweetText);
        console.log("Single test tweet posted successfully! ID:", createdTweet.id, "Text:", createdTweet.text);
    } catch (error) {
        console.error("Error during single test tweet operation:", error);
    }
}
// testPostTweet_Example(); 

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
            return response.data; 
        } else {
            console.error(`Failed to fetch HTML: Status code ${response.status}`);
            return null;
        }
    } catch (error) {
        console.error(`Error fetching HTML from ${url}:`, error.message);
        return null;
    }
}

// --- Function to Analyze HTML and get Structured JSON from Gemini ---
async function analyzeHtmlAndGetJsonFromGemini(htmlContent) {
    if (!process.env.GEMINI_API_KEY) {
        console.error("Error: GEMINI_API_KEY not found in .env file.");
        return null;
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const modelName = "gemini-2.5-flash-preview-05-20"; 
    
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
            generationConfig: { 
                responseMimeType: "application/json",
            }
        });
        
        const prompt = `
Analyze the following HTML document, which is the Techmeme homepage.
Identify the top 2 or 3 most significant news items related to Artificial Intelligence (AI), Machine Learning (ML), Large Language Models (LLMs), or major AI company news.
For each news item, provide: "headline" (concise, <70 chars), "summary" (brief, <150 chars), "link" (direct URL), and "hashtags" (array of 2-3 relevant strings).
Return ONLY a valid JSON array of objects. Each object must have keys "headline", "summary", "link", and "hashtags".
Example: [{"headline": "AI News", "summary": "Summary.", "link": "url", "hashtags": ["#AI"]}]
Do not include any text before or after the JSON array.
HTML DOCUMENT:
---BEGIN HTML---
${htmlContent}
---END HTML---`;

        // console.log(`Sending prompt to Gemini for JSON output (HTML length: ${htmlContent.length})...`); // Verbose
        
        const generationResult = await model.generateContent(prompt);
        const response = generationResult.response;
        
        if (!response || typeof response.text !== 'function') {
            console.error("Gemini did not return a valid response structure for JSON.");
            if (generationResult?.response?.promptFeedback) { 
                 console.error("Prompt Feedback:", generationResult.response.promptFeedback);
            }
            return null;
        }
        
        const jsonString = response.text();
        // console.log("Gemini Raw JSON String Response:", jsonString); // Verbose

        try {
            const parsedJson = JSON.parse(jsonString);
            // console.log("\nSuccessfully parsed JSON from Gemini:", JSON.stringify(parsedJson, null, 2)); // Verbose
            return parsedJson; 
        } catch (parseError) {
            console.error("\nError parsing JSON string from Gemini:", parseError.message);
            console.error("Raw string from Gemini was:", jsonString);
            return null;
        }

    } catch (error) { 
        console.error("Error during Gemini structured JSON operation:", error.message);
        if (error.response?.promptFeedback) { 
             console.error("Prompt Feedback:", error.response.promptFeedback);
        } else if (error.status && error.statusText) {
            console.error(`API Error: ${error.status} ${error.statusText}`);
        } else {
             console.error("Full error object:", error); 
        }
        return null;
    }
}

// --- Function to Post News Thread to Twitter ---
async function postNewsThreadToTwitter(newsItems) {
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
        const currentDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); // e.g., "May 31, 2025"

        // 1. Post Intro Tweet
        const introText = `🚀 AI News & Insights for ${currentDate}! 🧵👇 #AINews #TechUpdate`; // DYNAMIC INTRO
        console.log(`Posting intro: "${introText}"`);
        const { data: introTweet } = await rwClient.v2.tweet(introText);
        previousTweetId = introTweet.id;
        console.log(`Intro tweet posted. ID: ${previousTweetId}`);

        await new Promise(resolve => setTimeout(resolve, 2000)); 

        // 2. Post each news item
        for (let i = 0; i < newsItems.length; i++) {
            const item = newsItems[i];
            // Ensure hashtags is an array before joining
            const hashtagString = Array.isArray(item.hashtags) ? item.hashtags.join(" ") : ""; 
            
            let tweetText = `${item.headline}\n\n${item.summary}\n\n${item.link}\n\n${hashtagString}`;
            
            if (tweetText.length > 280) {
                const availableLengthForSummary = 280 - (item.headline.length + item.link.length + hashtagString.length + 6); // 6 for newlines and spaces
                if (item.summary.length > availableLengthForSummary -3 ) { // -3 for "..."
                    item.summary = item.summary.substring(0, availableLengthForSummary - 3) + "...";
                }
                tweetText = `${item.headline}\n\n${item.summary}\n\n${item.link}\n\n${hashtagString}`;
                 if (tweetText.length > 280) { 
                    tweetText = tweetText.substring(0, 277) + "..."; // Final aggressive truncate
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
        } 

        await new Promise(resolve => setTimeout(resolve, 2000)); 

        // 3. Post Outro Tweet
        const outroText = `That's today's AI brief for ${currentDate}! Follow for more insights. 💡 #AICommunity`; // DYNAMIC OUTRO
        console.log(`Posting outro: "${outroText}"`);
        const { data: outroTweet } = await rwClient.v2.tweet(outroText, {
            reply: { in_reply_to_tweet_id: previousTweetId }
        });
        console.log(`Outro tweet posted. ID: ${outroTweet.id}`);
        
        console.log("\nNews thread posted successfully to Twitter!");

    } catch (error) { 
        console.error("\nError posting news thread to Twitter:");
        if (error.code === 401) { console.error("Unauthorized (401): Check Twitter API keys/permissions."); }
        else if (error.code === 403) { 
            console.error("Forbidden (403): Possible rate limit, content issue, or app permission problem.");
            if (error.data && error.data.detail && error.data.detail.toLowerCase().includes("duplicate content")) {
                console.error("Detail: Twitter flagged this as duplicate content.");
            }
        }
        if (error.data && error.data.errors) { console.error("API Error Details:", JSON.stringify(error.data.errors, null, 2)); }
        else if (error.data && !error.data.errors) { console.error("API Error Data:", JSON.stringify(error.data, null, 2)); } // Log data if errors array isn't present
        else if (!error.data) { console.error("Full error object:", error); } // Log full error if no data field
    } 
} 

// --- Main Bot Logic Orchestrator ---
async function mainBotLogic() { 
    console.log(`--- ${new Date().toISOString()}: Starting AI News Bot Cycle ---`);
    const htmlContent = await fetchTechmemeHtml();

    if (htmlContent) {
        const structuredNewsData = await analyzeHtmlAndGetJsonFromGemini(htmlContent); 
        if (structuredNewsData && Array.isArray(structuredNewsData) && structuredNewsData.length > 0) {
            console.log(`\nSuccessfully received and parsed ${structuredNewsData.length} news items from Gemini.`);
            await postNewsThreadToTwitter(structuredNewsData); 
        } else {
            console.log("\nFailed to get structured news data from Gemini, data is not an array, or no news items found.");
        }
    } else {
        console.log("\nFailed to fetch HTML content. Cannot proceed with this cycle.");
    } 
    console.log(`--- ${new Date().toISOString()}: AI News Bot Cycle Ended ---`);
} 

// --- Execution ---
mainBotLogic();