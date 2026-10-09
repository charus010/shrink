const express=require('express'),multer=require('multer'),sharp=require('sharp'),archiver=require('archiver'),fs=require('fs'),path=require('path'),crypto=require('crypto'),nodemailer=require('nodemailer'),helmet=require('helmet'),compression=require('compression'),rateLimit=require('express-rate-limit');
const {render,articles,staticPages,SITE}=require('./views');
const app=express(),TMP=path.join(__dirname,'tmp'),meta=new Map();
app.set('trust proxy',1);
app.use(helmet({contentSecurityPolicy:false}),compression(),express.urlencoded({extended:false}));
app.use(express.static(path.join(__dirname,'public'),{maxAge:'7d'}));
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:9*1024*1024,files:10},
 fileFilter:(q,f,cb)=>/^image\/(jpeg|png|gif)$/.test(f.mimetype)?cb(null,true):cb(new Error('TYPE'))});
const EXT={'image/jpeg':'jpg','image/png':'png','image/gif':'gif'};

app.post('/api/compress',rateLimit({windowMs:60000,limit:30}),upload.array('images',10),async(req,res)=>{
 const q=Math.min(90,Math.max(10,parseInt(req.body.quality)||70));const out=[];
 try{for(const f of req.files||[]){
  const ext=EXT[f.mimetype],id=crypto.randomBytes(8).toString('hex')+'.'+ext;
  let p=sharp(f.buffer,{animated:ext==='gif'}).rotate();
  p=ext==='jpg'?p.jpeg({quality:q,mozjpeg:true}):ext==='png'?p.png({quality:q,palette:true,compressionLevel:9}):p.gif({effort:7});
  let buf=await p.toBuffer();if(buf.length>=f.size)buf=f.buffer; // never return a larger file
  fs.writeFileSync(path.join(TMP,id),buf);meta.set(id,f.originalname);
  out.push({id,name:f.originalname,original:f.size,compressed:buf.length,saved:Math.round((1-buf.length/f.size)*100)});}
  res.json({files:out});}catch(e){res.status(500).json({error:'Could not process one of the images. It may be corrupted.'});}});

const okId=i=>/^[a-f0-9]{16}\.(jpg|png|gif)$/.test(i)&&fs.existsSync(path.join(TMP,i));
app.get('/api/file/:id',(q,r)=>okId(q.params.id)?r.download(path.join(TMP,q.params.id),'min-'+(meta.get(q.params.id)||q.params.id)):r.status(404).send('Expired or not found'));
app.get('/api/zip',(q,r)=>{const ids=String(q.query.ids||'').split(',').filter(okId).slice(0,10);
 if(!ids.length)return r.status(404).send('Expired or not found');
 r.attachment('shrinkpix-images.zip');const z=archiver('zip');z.pipe(r);
 ids.forEach(i=>z.file(path.join(TMP,i),{name:'min-'+(meta.get(i)||i)}));z.finalize();});

// auto-delete after 30 minutes
setInterval(()=>{const now=Date.now();for(const f of fs.readdirSync(TMP)){const p=path.join(TMP,f);
 if(now-fs.statSync(p).mtimeMs>30*60*1000){fs.unlinkSync(p);meta.delete(f);}}},5*60*1000);

app.get('/',(q,r)=>r.send(render('home',{})));
app.get('/blog',(q,r)=>r.send(render('blog',{})));
app.get('/blog/category/:c',(q,r)=>r.send(render('blog',{cat:q.params.c})));
app.get('/blog/:slug',(q,r,n)=>articles.find(a=>a.slug===q.params.slug)?r.send(render('article',{slug:q.params.slug})):n());
app.get('/contact',(q,r)=>r.send(render('contact',{sent:q.query.sent,err:q.query.err})));
app.post('/contact',rateLimit({windowMs:3600000,limit:5}),async(q,r)=>{
 const {name,email,message,website}=q.body;if(website)return r.redirect('/contact?sent=1'); // honeypot
 if(!name||!/^\S+@\S+\.\S+$/.test(email||'')||!message||message.length<10)return r.redirect('/contact?err=1');
 try{await nodemailer.createTransport({host:process.env.SMTP_HOST,port:+process.env.SMTP_PORT||587,auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}})
  .sendMail({from:process.env.SMTP_USER,to:process.env.CONTACT_TO,replyTo:email,subject:'ShrinkPix contact: '+name,text:message});r.redirect('/contact?sent=1');}
 catch(e){console.error(e);r.redirect('/contact?err=1');}});
for(const k of Object.keys(staticPages))app.get('/'+k,(q,r)=>r.send(render(k,{})));
app.get('/sitemap.xml',(q,r)=>{const u=['','blog','contact',...Object.keys(staticPages),...articles.map(a=>'blog/'+a.slug)];
 r.type('xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${u.map(x=>`<url><loc>${SITE}/${x}</loc></url>`).join('')}</urlset>`);});
app.get('/robots.txt',(q,r)=>r.type('text').send(`User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml`));
app.use((e,q,r,n)=>{const m={TYPE:'Only JPG, JPEG, PNG and GIF files are supported.',LIMIT_FILE_SIZE:'One of your files is larger than 9 MB.',LIMIT_FILE_COUNT:'You can upload up to 10 images at a time.'}[e.code||e.message];
 r.status(m?400:500).json({error:m||'Something went wrong. Please try again.'});});
app.use((q,r)=>r.status(404).send(render('404',{})));
app.listen(process.env.PORT||3000,()=>console.log('ShrinkPix running'));
