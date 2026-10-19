const origin='https://sugar-inventory.vercel.app';
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const validPublicSlug=slug=>typeof slug==='string'&&slug.length>=3&&slug.length<=64&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
export function socialMetadata(slug){
 const shared=validPublicSlug(slug),url=shared?origin+'/view/'+slug:origin+'/';
 const title=shared?'Sugar Inventory — Public View':'Sugar Inventory';
 const description=shared?'View sugar stock, SRO balances and delivery records. Read-only access; no sign-in required.':'Track sugar stock, SRO quantities and deliveries in one shared inventory workspace.';
 return `<!-- social-preview:start -->
<meta name="description" content="${escape(description)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Sugar Inventory">
<meta property="og:locale" content="en_US">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${escape(title)}">
<meta property="og:description" content="${escape(description)}">
<meta property="og:image" content="${origin}/share-preview-v1.png">
<meta property="og:image:secure_url" content="${origin}/share-preview-v1.png">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Sugar Inventory. Public stock and delivery overview. Read-only access.">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escape(title)}">
<meta name="twitter:description" content="${escape(description)}">
<meta name="twitter:image" content="${origin}/share-preview-v1.png">
<!-- social-preview:end -->`;
}
export function previewHtml(html,slug){
 return html.replace(/<title>[^<]*<\/title>/,'<title>Sugar Inventory — Public View</title>').replace(/<!-- social-preview:start -->[\s\S]*?<!-- social-preview:end -->/,socialMetadata(slug));
}
