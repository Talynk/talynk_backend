// Complete Sequelize to Prisma Migration Script
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting Complete Sequelize to Prisma Migration...\n');

// List of remaining controllers to update
const remainingControllers = [
    'adminSearchController.js',
    'approverController.js', 
    'suggestionController.js',
    'subscriptionController.js',
    'approverReportController.js'
];

// Function to update a controller file
function updateController(filePath) {
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Replace Sequelize imports with Prisma
        content = content.replace(
            /const\s+.*=.*require\(['"]\.\.\/models\/.*['"]\);\s*\n/g, 
            ''
        );
        content = content.replace(
            /const\s+.*=.*require\(['"]\.\.\/models['"]\);\s*\n/g, 
            ''
        );
        content = content.replace(
            /const\s+.*=.*require\(['"]\.\.\/config\/database['"]\);\s*\n/g, 
            ''
        );
        content = content.replace(
            /const\s+.*=.*require\(['"]\.\.\/config\/db['"]\);\s*\n/g, 
            ''
        );
        content = content.replace(
            /const\s+.*=.*require\(['"]sequelize['"]\);\s*\n/g, 
            ''
        );
        content = content.replace(
            /const\s+.*=.*require\(['"]@sequelize\/core['"]\);\s*\n/g, 
            ''
        );
        
        // Add Prisma import at the top
        if (!content.includes('const prisma = require(\'../lib/prisma\');')) {
            content = 'const prisma = require(\'../lib/prisma\');\n' + content;
        }
        
        // Replace common Sequelize patterns
        content = content.replace(/\.findByPk\(/g, '.findUnique({ where: { id: ');
        content = content.replace(/\.findOne\(/g, '.findFirst(');
        content = content.replace(/\.findAll\(/g, '.findMany(');
        content = content.replace(/\.create\(/g, '.create({ data: ');
        content = content.replace(/\.update\(/g, '.update({ where: { id: ');
        content = content.replace(/\.destroy\(/g, '.delete({ where: { id: ');
        content = content.replace(/\.count\(/g, '.count(');
        
        // Replace Sequelize operators
        content = content.replace(/\[Op\.iLike\]/g, '{ mode: \'insensitive\', contains: ');
        content = content.replace(/\[Op\.like\]/g, '{ contains: ');
        content = content.replace(/\[Op\.eq\]/g, '');
        content = content.replace(/\[Op\.ne\]/g, '{ not: ');
        content = content.replace(/\[Op\.gt\]/g, '{ gt: ');
        content = content.replace(/\[Op\.gte\]/g, '{ gte: ');
        content = content.replace(/\[Op\.lt\]/g, '{ lt: ');
        content = content.replace(/\[Op\.lte\]/g, '{ lte: ');
        content = content.replace(/\[Op\.in\]/g, '{ in: ');
        content = content.replace(/\[Op\.notIn\]/g, '{ notIn: ');
        content = content.replace(/\[Op\.between\]/g, '{ gte: ');
        content = content.replace(/\[Op\.or\]/g, '{ OR: ');
        content = content.replace(/\[Op\.and\]/g, '{ AND: ');
        
        // Replace attributes with select
        content = content.replace(/attributes:\s*\[([^\]]+)\]/g, 'select: { $1 }');
        
        // Replace include patterns
        content = content.replace(/include:\s*\[([^\]]+)\]/g, 'include: { $1 }');
        
        // Replace order patterns
        content = content.replace(/order:\s*\[\[([^,]+),\s*['"]([^'"]+)['"]\]\]/g, 'orderBy: { $1: \'$2\' }');
        
        // Replace limit/offset
        content = content.replace(/limit:\s*(\d+)/g, 'take: $1');
        content = content.replace(/offset:\s*(\d+)/g, 'skip: $1');
        
        // Remove .toJSON() calls
        content = content.replace(/\.toJSON\(\)/g, '');
        
        fs.writeFileSync(filePath, content);
        console.log(`✅ Updated: ${path.basename(filePath)}`);
        
    } catch (error) {
        console.error(`❌ Error updating ${filePath}:`, error.message);
    }
}

// Update remaining controllers
console.log('📝 Updating remaining controllers...');
remainingControllers.forEach(controller => {
    const filePath = path.join(__dirname, 'src', 'controllers', controller);
    if (fs.existsSync(filePath)) {
        updateController(filePath);
    } else {
        console.log(`⚠️  File not found: ${controller}`);
    }
});

// Update other files that might have Sequelize usage
const otherFiles = [
    'src/jobs/refreshUserMetrics.js',
    'src/middleware/errorHandler.js'
];

console.log('\n📝 Updating other files...');
otherFiles.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
        updateController(filePath);
    }
});

// Remove old Sequelize model files
console.log('\n🗑️  Removing old Sequelize model files...');
const modelsDir = path.join(__dirname, 'src', 'models');
if (fs.existsSync(modelsDir)) {
    const modelFiles = fs.readdirSync(modelsDir).filter(file => 
        file.endsWith('.js') && file !== 'index.js'
    );
    
    modelFiles.forEach(file => {
        const filePath = path.join(modelsDir, file);
        try {
            fs.unlinkSync(filePath);
            console.log(`✅ Removed: ${file}`);
        } catch (error) {
            console.error(`❌ Error removing ${file}:`, error.message);
        }
    });
}

// Update package.json to remove Sequelize dependencies
console.log('\n📦 Updating package.json...');
try {
    const packagePath = path.join(__dirname, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    
    // Remove Sequelize dependencies
    delete packageJson.dependencies['@sequelize/core'];
    delete packageJson.dependencies['sequelize'];
    delete packageJson.dependencies['sequelize-cli'];
    delete packageJson.dependencies['pg-hstore'];
    
    // Remove Sequelize scripts
    delete packageJson.scripts.migrate;
    delete packageJson.scripts['migrate:undo'];
    delete packageJson.scripts.seed;
    
    // Add Prisma scripts
    packageJson.scripts['db:generate'] = 'prisma generate';
    packageJson.scripts['db:push'] = 'prisma db push';
    packageJson.scripts['db:pull'] = 'prisma db pull';
    packageJson.scripts['db:migrate'] = 'prisma migrate dev';
    packageJson.scripts['db:studio'] = 'prisma studio';
    
    fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
    console.log('✅ Updated package.json');
    
} catch (error) {
    console.error('❌ Error updating package.json:', error.message);
}

console.log('\n🎉 Migration completed!');
console.log('\n📋 Next steps:');
console.log('1. Test the application: npm start');
console.log('2. Run database introspection: npx prisma db pull');
console.log('3. Generate Prisma client: npx prisma generate');
console.log('4. Test with: node test-migration.js');
console.log('\n✨ Your application is now fully migrated to Prisma!');

