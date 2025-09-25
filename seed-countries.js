const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function seedCountries() {
    try {
        console.log('🌍 Starting country seeding process...\n');

        // Read the countries JSON file
        const countriesPath = path.join(__dirname, 'countries.json');
        const countriesData = JSON.parse(fs.readFileSync(countriesPath, 'utf8'));
        
        console.log(`📄 Loaded ${countriesData.data.countries.length} countries from JSON file`);

        // Check if countries already exist
        const existingCount = await prisma.country.count();
        console.log(`📊 Current countries in database: ${existingCount}`);

        if (existingCount > 0) {
            console.log('⚠️  Countries already exist in database. Clearing existing data...');
            await prisma.country.deleteMany({});
            console.log('✅ Cleared existing countries');
        }

        // Prepare countries data for insertion
        const countriesToInsert = countriesData.data.countries.map(country => ({
            id: country.id,
            name: country.name,
            code: country.code,
            flag_emoji: country.flag_emoji,
            is_active: country.is_active
        }));

        console.log('📝 Inserting countries into database...');

        // Insert countries in batches to avoid memory issues
        const batchSize = 50;
        let insertedCount = 0;

        for (let i = 0; i < countriesToInsert.length; i += batchSize) {
            const batch = countriesToInsert.slice(i, i + batchSize);
            await prisma.country.createMany({
                data: batch,
                skipDuplicates: true
            });
            insertedCount += batch.length;
            console.log(`✅ Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(countriesToInsert.length / batchSize)} (${insertedCount}/${countriesToInsert.length} countries)`);
        }

        // Verify the insertion
        const finalCount = await prisma.country.count();
        console.log(`\n🎉 Country seeding completed successfully!`);
        console.log(`📊 Total countries in database: ${finalCount}`);

        // Show some sample countries
        const sampleCountries = await prisma.country.findMany({
            take: 5,
            orderBy: { id: 'asc' }
        });

        console.log('\n📋 Sample countries:');
        sampleCountries.forEach(country => {
            console.log(`  ${country.id}. ${country.name} (${country.code}) ${country.flag_emoji}`);
        });

    } catch (error) {
        console.error('❌ Error seeding countries:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Run the seeding process
seedCountries()
    .then(() => {
        console.log('\n✅ Country seeding process completed successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Country seeding process failed:', error);
        process.exit(1);
    });
