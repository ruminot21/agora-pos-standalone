export type DemoProduct = {id:string;name:string;category:string;price:number;stock:number;image:string;tracked:boolean;sku:string};
const rows: [string,string,number,number,string,boolean][] = [
  ['PLÁTANO KG','FRUTAS',1500,100,'platano',true],
  ['BÁLSAMO','ABARROTES',1500,100,'balsamo',true],
  ['PAPA','SNACK',1500,100,'papas',true],
  ['TABACO ROSS UVA','TABACO',4500,15,'ross-uva',true],
  ['RED BULL','BEBIDAS',1500,25,'redbull',true],
  ['AGUA','BEBIDAS',1500,100,'agua',true],
  ['DORITOS','SNACK',1500,25,'doritos',true],
  ['TABACO ROSS VAINILLA','TABACO',35000,100,'ross-vainilla',true],
  ['TABACO ROSS MENTA CHOCOLATE','TABACO',35000,100,'ross-menta',true],
  ['TECLADO','ELECTRÓNICA',1500,100,'teclado',true],
  ['RED BULL SUMMER DURAZNO','BEBIDAS',1800,10,'redbull-verano',true],
  ['COMPLETO ITALIANO','COMIDA',2500,20,'completo',true],
  ['SPRITE','BEBIDAS',1500,99,'sprite',true],
  ['COCA COLA 1 LITRO','BEBIDAS',1500,100,'cocacola',true],
  ['YOGURT','LÁCTEOS',1500,100,'yogurt',true],
  ['CHOCOLATES','SNACK',1500,50,'chocolates',true],
  ['TABACO ROSS SANDÍA','TABACO',4500,201,'ross-sandia',true],
  ['TABACO ROSS NATURAL','TABACO',4500,199,'ross-natural',true],
  ['PALL MALL SUNRISE','TABACO',4900,27,'pallmall',true],
  ['PALL MALL SUNRISE XL 20','TABACO',4900,100,'pallmall-xl',true],
  ['MONSTER','BEBIDAS',1800,100,'monster',true]
];
export const DEMO_PRODUCTS:DemoProduct[]=rows.map(([name,category,price,stock,image,tracked],i)=>({id:'demo-'+i,sku:'DEMO-'+String(i+1).padStart(3,'0'),name,category,price,stock,image:'/products/'+image+'.webp',tracked}));
export const imageForProduct = (p:{sku?:string;name?:string}) => {
  const found=DEMO_PRODUCTS.find(x=>x.sku===p.sku || (p.name&&x.name===p.name));
  return found?.image??null;
};
