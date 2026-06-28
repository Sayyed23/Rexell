

async function main() {
    const url = "https://identity-oracle-705407154234.us-central1.run.app/api/identity/attest";
    const payload = {
        user_address: "0x7027F4B8e3809F809A87C3d90F9De510742B5aCA"
    };

    console.log("Calling oracle endpoint:", url);
    console.log("Payload:", payload);

    try {
        const res = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        console.log("Status:", res.status);
        const data = await res.text();
        console.log("Response body:", data);
    } catch (e) {
        console.error("Error making request:", e.message);
    }
}

main();
