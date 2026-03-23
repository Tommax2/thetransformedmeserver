const getResendConfig = () => {
	const apiKey = process.env.RESEND_API_KEY;
	const apiUrl = process.env.RESEND_API_URL || "https://api.resend.com";
	return { apiKey, apiUrl };
};

export const sendEmail = async ({ to, subject, html, text, replyTo }) => {
	const from = process.env.EMAIL_FROM;
	if (!from) throw new Error("EMAIL_FROM is not configured");

	const { apiKey, apiUrl } = getResendConfig();
	if (!apiKey) throw new Error("RESEND_API_KEY is not configured");

	const payload = {
		from,
		to,
		subject,
		...(replyTo ? { reply_to: replyTo } : {}),
		...(html ? { html } : {}),
		...(text ? { text } : {}),
	};

	const response = await fetch(`${apiUrl.replace(/\/$/, "")}/emails`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(payload),
	});

	if (!response.ok) {
		let details = "";
		try {
			details = await response.text();
		} catch {
			// ignore
		}
		throw new Error(
			`Resend email failed (${response.status}): ${details || response.statusText}`
		);
	}

	return response.json().catch(() => ({}));
};
