const redis = require('redis');

(async () => {
    console.log('Testing Redis Connection...');
    const client = redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
    });

    client.on('error', (err) => {
        console.error('❌ Redis Client Error:', err);
        process.exit(1);
    });

    try {
        await client.connect();
        console.log('✅ Connected to Redis successfully!');
        await client.set('test_key', 'Hello Redis');
        const value = await client.get('test_key');
        console.log('Test Value retrieved:', value);
        await client.disconnect();
        process.exit(0);
    } catch (err) {
        console.error('❌ Failed to connect:', err);
        process.exit(1);
    }
})();
