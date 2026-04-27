const axios = require("axios");

async function getPRFiles(owner, repo, prNumber) {
  try {
    const response = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files`,
      {
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error("Error fetching PR files:", error.message);
    return [];
  }
}

module.exports = { getPRFiles };