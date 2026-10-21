-- Final Barber · catálogo + conta de demonstração (gerado em 2026-10-21).
-- Rode depois do schema.sql. Pode rodar de novo: atualiza o que já existe.
begin;

insert into shop_settings (id,name,tagline,instagram,member_count_label,rating_label,cover_photo_url,portfolio) values
(1,'Mister Bigode','Mais que um corte. Uma experiência.','@misterbigode_of','+500 membros no Mister Club','4,9 no Google · +700 avaliações','https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=1600&q=70','[{"url":"https://images.unsplash.com/photo-1593702275687-f8b402bf1fb5?auto=format&fit=crop&w=700&q=70","caption":"Corte social na tesoura","barberId":"barber-bigode"},{"url":"https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=700&q=70","caption":"Acabamento na navalha","barberId":"barber-markos"},{"url":"https://images.unsplash.com/photo-1517832606299-7ae9b720a186?auto=format&fit=crop&w=700&q=70","caption":"Barba alinhada","barberId":"barber-herbert"},{"url":"https://images.unsplash.com/photo-1635273051937-a0ddef9573b6?auto=format&fit=crop&w=700&q=70","caption":"Degradê na máquina","barberId":"barber-gustavo"},{"url":"https://images.unsplash.com/photo-1657105052497-f996284ffff8?auto=format&fit=crop&w=700&q=70","caption":"Corte com textura","barberId":"barber-jey"},{"url":"https://images.unsplash.com/photo-1648221122323-572c13a31663?auto=format&fit=crop&w=700&q=70","caption":"Corte clássico","barberId":"barber-jonathan"},{"url":"https://images.unsplash.com/photo-1647140655214-e4a2d914971f?auto=format&fit=crop&w=700&q=70","caption":"Corte na tesoura","barberId":"barber-silas"},{"url":"https://images.unsplash.com/photo-1605497788044-5a32c7078486?auto=format&fit=crop&w=700&q=70","caption":"Finalização com escova","barberId":"barber-matheus"}]'::jsonb)
on conflict (id) do update set name = excluded.name, tagline = excluded.tagline, instagram = excluded.instagram, member_count_label = excluded.member_count_label, rating_label = excluded.rating_label, cover_photo_url = excluded.cover_photo_url, portfolio = excluded.portfolio;

insert into units (id,name,address,phone,photo_url,hours) values
('unit-chacara','Chácara Santo Antônio','Rua José de Carvalho, 191 · São Paulo','(11) 97727-1896','https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=1200&q=70','[null,{"open":540,"close":1200},{"open":540,"close":1200},{"open":540,"close":1200},{"open":540,"close":1200},{"open":540,"close":1200},{"open":540,"close":1140}]'::jsonb),
('unit-guarapiranga','Guarapiranga','Avenida Guarapiranga, 2431 · São Paulo',null,'https://images.unsplash.com/photo-1759134198561-e2041049419c?auto=format&fit=crop&w=1200&q=70','[null,{"open":540,"close":1200},{"open":540,"close":1200},{"open":540,"close":1200},{"open":540,"close":1200},{"open":540,"close":1200},{"open":540,"close":1140}]'::jsonb)
on conflict (id) do update set name = excluded.name, address = excluded.address, phone = excluded.phone, photo_url = excluded.photo_url, hours = excluded.hours;

insert into barbers (id,name,unit_id,active,service_commission,product_commission) values
('barber-bigode','Bigode','unit-chacara',true,0.4,0.1),
('barber-markos','Markos Henrique','unit-chacara',true,0.4,0.1),
('barber-herbert','Herbert','unit-chacara',true,0.4,0.1),
('barber-jonathan','Jonathan Aguiar','unit-chacara',true,0.4,0.1),
('barber-silas','Silas Silva','unit-chacara',true,0.4,0.1),
('barber-gustavo','Gustavo','unit-guarapiranga',true,0.4,0.1),
('barber-jey','Jey','unit-guarapiranga',true,0.4,0.1),
('barber-jhonny','Jhonny','unit-guarapiranga',true,0.4,0.1),
('barber-matheus','Matheus','unit-guarapiranga',true,0.4,0.1),
('barber-former','Rodrigo (desligado)','unit-guarapiranga',false,0.4,0.1)
on conflict (id) do update set name = excluded.name, unit_id = excluded.unit_id, active = excluded.active, service_commission = excluded.service_commission, product_commission = excluded.product_commission;

insert into services (id,name,category,duration_min,price_cents,coverage,bookable) values
('svc-haircut','Corte','hair',40,8000,'haircut',true),
('svc-haircut-scissor','Corte afro ou tesoura','hair',50,9000,'haircut',true),
('svc-haircut-kids','Corte infantil','hair',30,5500,null,true),
('svc-haircut-women','Corte feminino','hair',50,9000,null,true),
('svc-neckline','Pezinho (acabamento)','hair',15,2500,null,true),
('svc-freestyle','Freestyle','hair',20,3000,null,true),
('svc-styling','Penteado','hair',20,4000,null,true),
('svc-blowdry','Escova','hair',30,4500,null,true),
('svc-beard','Barba','beard',30,6500,'beard',true),
('svc-mustache','Bigode','beard',15,2500,null,true),
('svc-hydration','Hidratação','treatment',30,5000,null,true),
('svc-straightening','Botox / progressiva','treatment',90,15000,null,true),
('svc-scalp-therapy','Terapia capilar','treatment',45,9000,null,true),
('svc-scrub','Esfoliante','treatment',15,3500,null,true),
('svc-facial-spa','Spa facial','treatment',40,8000,null,true),
('svc-facial-spa-pores','Spa + remoção de cravos','treatment',60,11000,null,true),
('svc-relaxing','Relaxamento','treatment',60,8000,null,true),
('svc-pigmentation','Pigmentação','treatment',20,5000,null,true),
('svc-toppik','Toppik','treatment',15,3000,null,true),
('svc-hair-prosthesis','Manutenção de prótese capilar','treatment',90,20000,null,true),
('svc-eyebrow','Sobrancelha','finishing',15,2500,null,true),
('svc-eyebrow-wax','Sobrancelha na cera','finishing',15,3000,null,true),
('svc-nose-ear-wax','Depilação de nariz ou orelha','finishing',10,2000,null,true)
on conflict (id) do update set name = excluded.name, category = excluded.category, duration_min = excluded.duration_min, price_cents = excluded.price_cents, coverage = excluded.coverage, bookable = excluded.bookable;

insert into plans (id,name,tier,covers,price_cents,highlight,benefits,sort_order) values
('plan-cb-plus','Mister Club C+B Plus','plus',array['haircut','beard']::text[],24999,null,array['Corte incluso','Barba inclusa','Vigência por tempo indeterminado','Cobrança mensal automática']::text[],1),
('plan-haircut-plus','Mister Club Corte Plus','plus',array['haircut']::text[],14999,null,array['Corte incluso','Vigência por tempo indeterminado','Cobrança mensal automática']::text[],2),
('plan-beard-plus','Mister Club Barba Plus','plus',array['beard']::text[],15999,null,array['Barba inclusa','Vigência por tempo indeterminado','Cobrança mensal automática']::text[],3),
('plan-cb-premium','Mister Club Premium Corte e Barba','premium',array['haircut','beard']::text[],34999,'best_seller',array['Corte incluso','Barba inclusa','Vigência por tempo indeterminado','Cobrança mensal automática']::text[],4),
('plan-beard-premium','Mister Club Premium Barba','premium',array['beard']::text[],22999,null,array['Barba inclusa','Vigência por tempo indeterminado','Cobrança mensal automática']::text[],5),
('plan-haircut-premium','Mister Club Premium Corte','premium',array['haircut']::text[],19999,null,array['Corte incluso','Vigência por tempo indeterminado','Cobrança mensal automática']::text[],6)
on conflict (id) do update set name = excluded.name, tier = excluded.tier, covers = excluded.covers, price_cents = excluded.price_cents, highlight = excluded.highlight, benefits = excluded.benefits, sort_order = excluded.sort_order;

insert into products (id,name,category,description,price_cents,cost_cents,stock,min_stock,active,photo_url) values
('prd-pomade-matte','Pomada modeladora efeito seco','hair','Fixação forte e acabamento matte, para o dia todo.',5990,2696,18,4,true,'https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=600&q=70'),
('prd-pomade-shine','Pomada efeito brilho','hair','Fixação média com brilho, ideal para penteados clássicos.',5990,2696,11,4,true,null),
('prd-texture-powder','Pó texturizador','hair','Volume e textura sem pesar no cabelo.',4990,2246,3,4,true,'https://images.unsplash.com/photo-1627875777314-da35433c0c8e?auto=format&fit=crop&w=600&q=70'),
('prd-hair-tonic','Tônico capilar','hair','Uso diário para fortalecer o couro cabeludo.',6990,3146,9,4,true,'https://images.unsplash.com/photo-1620018646973-e3e257a1002c?auto=format&fit=crop&w=600&q=70'),
('prd-shampoo-daily','Shampoo uso diário','hair','Limpeza suave para cabelo masculino.',4490,2021,14,4,true,null),
('prd-beard-oil','Óleo para barba','beard','Hidrata os fios e a pele, sem deixar oleosa.',4990,2246,22,4,true,'https://images.unsplash.com/photo-1673350963924-cb4267d9b6eb?auto=format&fit=crop&w=600&q=70'),
('prd-beard-balm','Balm para barba','beard','Alinha e modela a barba com leve fixação.',4490,2021,7,4,true,'https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=600&q=70'),
('prd-beard-shampoo','Shampoo para barba','beard','Limpa sem ressecar a pele do rosto.',3990,1796,12,4,true,'https://images.unsplash.com/photo-1627875777089-d32f1127e9ff?auto=format&fit=crop&w=600&q=70'),
('prd-aftershave','Pós-barba calmante','skin','Acalma a pele depois do barbear.',3990,1796,2,4,true,'https://images.unsplash.com/photo-1627876280688-24a58ba02f2c?auto=format&fit=crop&w=600&q=70'),
('prd-face-scrub','Esfoliante facial','skin','Remove impurezas e prepara a pele para o barbear.',4290,1931,8,4,true,null),
('prd-wood-comb','Pente de madeira','accessory','Antiestático, para barba e cabelo.',2490,1121,25,4,true,null),
('prd-beard-kit','Kit barba completa','accessory','Óleo, balm e shampoo para barba com desconto.',11990,5396,5,3,true,'https://images.unsplash.com/photo-1673350963997-fc802e774580?auto=format&fit=crop&w=600&q=70')
on conflict (id) do update set name = excluded.name, category = excluded.category, description = excluded.description, price_cents = excluded.price_cents, cost_cents = excluded.cost_cents, stock = excluded.stock, min_stock = excluded.min_stock, active = excluded.active, photo_url = excluded.photo_url;

insert into customers (id,name,phone,cycle_days,preferred_barber_id,created_at,holder_id,relationship,minor,referral_code) values
('cust-rafael','Rafael Lima','(11) 98888-1234',14,'barber-bigode','2025-09-16T13:00:00.000Z',null,null,false,'RAFAEL-7021')
on conflict (id) do update set name = excluded.name, phone = excluded.phone, cycle_days = excluded.cycle_days, preferred_barber_id = excluded.preferred_barber_id, created_at = excluded.created_at, holder_id = excluded.holder_id, relationship = excluded.relationship, minor = excluded.minor, referral_code = excluded.referral_code;

insert into customers (id,name,phone,cycle_days,preferred_barber_id,created_at,holder_id,relationship,minor,referral_code) values
('cust-pedro','Pedro Lima','(11) 98888-1234',14,'barber-markos','2026-02-23T13:00:00.000Z','cust-rafael','child',true,'PEDRO-7022'),
('cust-antonio','Antônio Ferraz','(11) 97777-5678',21,'barber-herbert','2026-08-22T13:00:00.000Z','cust-rafael','parent_in_law',false,'ANTONIO-7023')
on conflict (id) do update set name = excluded.name, phone = excluded.phone, cycle_days = excluded.cycle_days, preferred_barber_id = excluded.preferred_barber_id, created_at = excluded.created_at, holder_id = excluded.holder_id, relationship = excluded.relationship, minor = excluded.minor, referral_code = excluded.referral_code;

insert into subscriptions (id,customer_id,payer_customer_id,plan_id,status,started_at,canceled_at,billing_day,sold_by_barber_id,channel,referred_by_customer_id) values
('sub-rafael','cust-rafael','cust-rafael','plan-cb-plus','active','2026-02-18T13:00:00.000Z',null,5,'barber-bigode','counter',null),
('sub-pedro','cust-pedro','cust-rafael','plan-haircut-plus','active','2026-02-23T13:00:00.000Z',null,5,'barber-bigode','counter',null),
('sub-antonio','cust-antonio','cust-rafael','plan-beard-plus','active','2026-08-24T13:00:00.000Z',null,5,'barber-herbert','app',null)
on conflict (id) do update set customer_id = excluded.customer_id, payer_customer_id = excluded.payer_customer_id, plan_id = excluded.plan_id, status = excluded.status, started_at = excluded.started_at, canceled_at = excluded.canceled_at, billing_day = excluded.billing_day, sold_by_barber_id = excluded.sold_by_barber_id, channel = excluded.channel, referred_by_customer_id = excluded.referred_by_customer_id;

commit;
