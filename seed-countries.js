const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// List of countries with their ISO codes and flag emojis
const countries = [
    { name: 'United States', code: 'USA', flag_emoji: '🇺🇸' },
    { name: 'Canada', code: 'CAN', flag_emoji: '🇨🇦' },
    { name: 'United Kingdom', code: 'GBR', flag_emoji: '🇬🇧' },
    { name: 'Germany', code: 'DEU', flag_emoji: '🇩🇪' },
    { name: 'France', code: 'FRA', flag_emoji: '🇫🇷' },
    { name: 'Italy', code: 'ITA', flag_emoji: '🇮🇹' },
    { name: 'Spain', code: 'ESP', flag_emoji: '🇪🇸' },
    { name: 'Netherlands', code: 'NLD', flag_emoji: '🇳🇱' },
    { name: 'Belgium', code: 'BEL', flag_emoji: '🇧🇪' },
    { name: 'Switzerland', code: 'CHE', flag_emoji: '🇨🇭' },
    { name: 'Austria', code: 'AUT', flag_emoji: '🇦🇹' },
    { name: 'Sweden', code: 'SWE', flag_emoji: '🇸🇪' },
    { name: 'Norway', code: 'NOR', flag_emoji: '🇳🇴' },
    { name: 'Denmark', code: 'DNK', flag_emoji: '🇩🇰' },
    { name: 'Finland', code: 'FIN', flag_emoji: '🇫🇮' },
    { name: 'Poland', code: 'POL', flag_emoji: '🇵🇱' },
    { name: 'Czech Republic', code: 'CZE', flag_emoji: '🇨🇿' },
    { name: 'Hungary', code: 'HUN', flag_emoji: '🇭🇺' },
    { name: 'Portugal', code: 'PRT', flag_emoji: '🇵🇹' },
    { name: 'Greece', code: 'GRC', flag_emoji: '🇬🇷' },
    { name: 'Turkey', code: 'TUR', flag_emoji: '🇹🇷' },
    { name: 'Russia', code: 'RUS', flag_emoji: '🇷🇺' },
    { name: 'China', code: 'CHN', flag_emoji: '🇨🇳' },
    { name: 'Japan', code: 'JPN', flag_emoji: '🇯🇵' },
    { name: 'South Korea', code: 'KOR', flag_emoji: '🇰🇷' },
    { name: 'India', code: 'IND', flag_emoji: '🇮🇳' },
    { name: 'Australia', code: 'AUS', flag_emoji: '🇦🇺' },
    { name: 'New Zealand', code: 'NZL', flag_emoji: '🇳🇿' },
    { name: 'Brazil', code: 'BRA', flag_emoji: '🇧🇷' },
    { name: 'Argentina', code: 'ARG', flag_emoji: '🇦🇷' },
    { name: 'Mexico', code: 'MEX', flag_emoji: '🇲🇽' },
    { name: 'Chile', code: 'CHL', flag_emoji: '🇨🇱' },
    { name: 'Colombia', code: 'COL', flag_emoji: '🇨🇴' },
    { name: 'Peru', code: 'PER', flag_emoji: '🇵🇪' },
    { name: 'Venezuela', code: 'VEN', flag_emoji: '🇻🇪' },
    { name: 'South Africa', code: 'ZAF', flag_emoji: '🇿🇦' },
    { name: 'Egypt', code: 'EGY', flag_emoji: '🇪🇬' },
    { name: 'Nigeria', code: 'NGA', flag_emoji: '🇳🇬' },
    { name: 'Kenya', code: 'KEN', flag_emoji: '🇰🇪' },
    { name: 'Morocco', code: 'MAR', flag_emoji: '🇲🇦' },
    { name: 'Israel', code: 'ISR', flag_emoji: '🇮🇱' },
    { name: 'United Arab Emirates', code: 'ARE', flag_emoji: '🇦🇪' },
    { name: 'Saudi Arabia', code: 'SAU', flag_emoji: '🇸🇦' },
    { name: 'Thailand', code: 'THA', flag_emoji: '🇹🇭' },
    { name: 'Singapore', code: 'SGP', flag_emoji: '🇸🇬' },
    { name: 'Malaysia', code: 'MYS', flag_emoji: '🇲🇾' },
    { name: 'Indonesia', code: 'IDN', flag_emoji: '🇮🇩' },
    { name: 'Philippines', code: 'PHL', flag_emoji: '🇵🇭' },
    { name: 'Vietnam', code: 'VNM', flag_emoji: '🇻🇳' },
    { name: 'Ukraine', code: 'UKR', flag_emoji: '🇺🇦' },
    { name: 'Romania', code: 'ROU', flag_emoji: '🇷🇴' },
    { name: 'Bulgaria', code: 'BGR', flag_emoji: '🇧🇬' },
    { name: 'Croatia', code: 'HRV', flag_emoji: '🇭🇷' },
    { name: 'Serbia', code: 'SRB', flag_emoji: '🇷🇸' },
    { name: 'Slovenia', code: 'SVN', flag_emoji: '🇸🇮' },
    { name: 'Slovakia', code: 'SVK', flag_emoji: '🇸🇰' },
    { name: 'Lithuania', code: 'LTU', flag_emoji: '🇱🇹' },
    { name: 'Latvia', code: 'LVA', flag_emoji: '🇱🇻' },
    { name: 'Estonia', code: 'EST', flag_emoji: '🇪🇪' },
    { name: 'Ireland', code: 'IRL', flag_emoji: '🇮🇪' },
    { name: 'Iceland', code: 'ISL', flag_emoji: '🇮🇸' },
    { name: 'Luxembourg', code: 'LUX', flag_emoji: '🇱🇺' },
    { name: 'Malta', code: 'MLT', flag_emoji: '🇲🇹' },
    { name: 'Cyprus', code: 'CYP', flag_emoji: '🇨🇾' }
];

async function seedCountries() {
    try {
        console.log('🌍 Starting to seed countries...');

        // Clear existing countries
        await prisma.country.deleteMany({});
        console.log('🗑️ Cleared existing countries');

        // Insert new countries
        for (const country of countries) {
            await prisma.country.create({
                data: country
            });
        }

        console.log(`✅ Successfully seeded ${countries.length} countries`);

        // Display some statistics
        const totalCountries = await prisma.country.count();
        console.log(`📊 Total countries in database: ${totalCountries}`);

        // Show first few countries
        const sampleCountries = await prisma.country.findMany({
            take: 5,
            orderBy: { name: 'asc' }
        });

        console.log('🌍 Sample countries:');
        sampleCountries.forEach(country => {
            console.log(`  ${country.flag_emoji} ${country.name} (${country.code})`);
        });

    } catch (error) {
        console.error('❌ Error seeding countries:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// Run the seed function
seedCountries();
