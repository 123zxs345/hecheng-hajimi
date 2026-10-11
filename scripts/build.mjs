import {cp,mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const source=fileURLToPath(new URL('../',import.meta.url));
export async function exportPages(options={}){
  const site=new URL(options.siteUrl||process.env.SITE_URL||'https://123zxs345.github.io/hecheng-hajimi/');
  if(!['http:','https:'].includes(site.protocol)||site.search||site.hash)throw new Error('Site URL must be an HTTP origin and optional repository path');
  if(!site.pathname.endsWith('/'))site.pathname+='/';
  const siteUrl=site.href,outDir=resolve(options.outDir||join(source,'dist'));
  if(outDir===source||source.startsWith(outDir+ '\\')||source.startsWith(outDir+'/'))throw new Error('Export must use a separate output directory');
  await mkdir(outDir,{recursive:true});await cp(join(source,'public'),outDir,{recursive:true});
  const template=await readFile(join(source,'web/index.html'),'utf8');
  const html=template.replaceAll('__ORIGIN__/',siteUrl).replace(/\b(src|href)="\/(?!\/)/g,'$1="./');
  await writeFile(join(outDir,'index.html'),html,'utf8');
  const config={siteUrl,tinywebdb:{endpoint:options.endpoint||process.env.TINYWEBDB_ENDPOINT||'https://tinywebdb.appinventor.space/api',user:options.user||process.env.TINYWEBDB_USER||'',secret:options.secret||process.env.TINYWEBDB_KEY||'',prefix:options.prefix||process.env.TINYWEBDB_PREFIX||'hajimi_123zxs345_v1_'}};
  await writeFile(join(outDir,'hosting-config.js'),'window.HajimiHosting='+JSON.stringify(config).replaceAll('<','\\u003c')+';\n','utf8');
  await writeFile(join(outDir,'.nojekyll'),'','utf8');
  return {outDir,siteUrl,cloudConfigured:!!config.tinywebdb.user&&!!config.tinywebdb.secret};
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
  const options={};for(let i=2;i<process.argv.length;i+=2){const name=process.argv[i];if(!['--site-url','--out-dir'].includes(name)||!process.argv[i+1])throw new Error('Usage: node scripts/build.mjs [--site-url URL] [--out-dir PATH]');options[name==='--site-url'?'siteUrl':'outDir']=process.argv[i+1];}
  console.log(JSON.stringify(await exportPages(options)));
}
