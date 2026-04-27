const axios = require("axios");

async function commentOnPR(owner, repo, prNumber, comment) {
  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`;

    await axios.post(
      url,
      {
        body: comment
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json"
        }
      }
    );

    console.log("💬 Comment posted on PR!");
  } catch (error) {
    console.error("❌ Failed to comment:", error.message);
  }
}

module.exports = { commentOnPR };