const { uploadBase64 } = require("../supabase");

async function test() {
  try {
    const sampleBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const url = await uploadBase64(sampleBase64, "image", "test.png");
    console.log("TEST_RESULT_URL:", url);
  } catch (e) {
    console.error("TEST_ERROR:", e);
  }
}

test();
