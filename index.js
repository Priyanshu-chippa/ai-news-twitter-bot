// index.js (Temporary test version for schedule trigger)
console.log("--- GitHub Actions Scheduled Trigger Test ---");
const currentDate = new Date().toISOString();
console.log(`Workflow triggered at (script time): ${currentDate}`);
console.log("SUCCESS: GitHub Actions schedule trigger worked as expected for the test!");
console.log("IMPORTANT: Revert index.js to the full bot logic & daily-tweet.yml to the daily schedule after this test.");