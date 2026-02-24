function generateSlug(text) {
    return text
        ?.toString()
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '') 
        .replace(/\s+/g, '-')         
        .replace(/-+/g, '-')          
        .replace(/^-+|-+$/g, '');     
}

module.exports = generateSlug