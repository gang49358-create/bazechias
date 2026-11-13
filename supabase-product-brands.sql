-- Baze China: add brand field for Poizon-style catalog filters
alter table public.products
  add column if not exists brand text not null default 'Другие';

update public.products
set brand = 'Другие'
where brand is null or btrim(brand) = '';
