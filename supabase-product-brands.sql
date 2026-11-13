-- Baze China: add brand field for Poizon-style catalog filters
alter table public.products
  add column if not exists brand text not null default 'Другие';

update public.products
set brand = case
  when lower(coalesce(brand,'') || ' ' || coalesce(name,'')) like '%nike%' then 'Nike'
  when lower(coalesce(brand,'') || ' ' || coalesce(name,'')) like '%adidas%' then 'Adidas'
  when lower(coalesce(brand,'') || ' ' || coalesce(name,'')) like '%new balance%' then 'New Balance'
  when lower(coalesce(brand,'') || ' ' || coalesce(name,'')) like '%asics%' then 'ASICS'
  when lower(coalesce(brand,'') || ' ' || coalesce(name,'')) like '%puma%' then 'Puma'
  when lower(coalesce(brand,'') || ' ' || coalesce(name,'')) like '%jordan%' then 'Jordan'
  when lower(coalesce(brand,'') || ' ' || coalesce(name,'')) like '%converse%' then 'Converse'
  when lower(coalesce(brand,'') || ' ' || coalesce(name,'')) like '%vans%' then 'Vans'
  when lower(coalesce(brand,'') || ' ' || coalesce(name,'')) like '%reebok%' then 'Reebok'
  when lower(coalesce(brand,'') || ' ' || coalesce(name,'')) like '%salomon%' then 'Salomon'
  when lower(coalesce(brand,'') || ' ' || coalesce(name,'')) like '%yeezy%' then 'Yeezy'
  else coalesce(nullif(btrim(brand),''),'Другие')
end;
