const SUPABASE_URL = (
    process.env.SUPABASE_URL || ""
).replace(/\/$/, "");
//new code 
const SUPABASE_SERVICE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

const SUPABASE_BUCKET =
    process.env.SUPABASE_BUCKET || "report-images";

export const supabaseStorageEnabled = Boolean(
    SUPABASE_URL && SUPABASE_SERVICE_KEY
);

if (!supabaseStorageEnabled) {
    console.warn(
        "WARNING: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set. " +
        "Uploaded report images will not be persisted to permanent storage."
    );
}

export async function uploadBufferToSupabase(
    buffer,
    destPath,
    contentType = "image/jpeg"
) {
    if (!supabaseStorageEnabled) {
        return null;
    }

    const uploadUrl =
        `${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${destPath}`;

    const response = await fetch(uploadUrl, {
        method: "POST",

        headers: {
            "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
            "apikey": SUPABASE_SERVICE_KEY,
            "Content-Type": contentType,
            "x-upsert": "true",
        },

        body: buffer,
    });

    if (!response.ok) {
        console.error(
            `Supabase upload failed for ${destPath}:`,
            await response.text()
        );

        return null;
    }

    return (
        `${SUPABASE_URL}/storage/v1/object/public/` +
        `${SUPABASE_BUCKET}/${destPath}`
    );
}