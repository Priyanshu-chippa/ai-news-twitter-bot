// index.js (Temporary test version)
console.log("--- GitHub Actions Scheduled Trigger Test ---");
const currentDate = new Date().toISOString();
console.log(`Workflow triggered at (according to script): ${currentDate}`);
console.log("If you see this, the GitHub Actions schedule trigger worked!");
console.log("Remember to revert index.js to the full bot logic after this test.");
// No API calls, no complex logic, just a print statement.