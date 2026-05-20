export const colors = {
  cream: '#F7F3EE',
  bark: '#2C1F14',
  moss: '#3B6D11',
  'moss-light': '#EAF3DE',
  gold: '#BA7517',
  'gold-light': '#FAEEDA',
  muted: '#888780',
} as const;

export const animations = {
  fadeUp: '@keyframes fadeUp { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }',
  fadeDown: '@keyframes fadeDown { from { opacity: 0; transform: translateY(-12px); } to { opacity: 1; transform: translateY(0); } }',
};

export const navStyles = {
  ghost: 'p-2 px-4 rounded-md font-medium text-sm cursor-pointer border border-transparent bg-transparent hover:bg-[rgba(44,31,20,0.06)]',
  solid: 'p-2 px-4 rounded-md font-medium text-sm cursor-pointer border none bg-[--bark] text-[--cream]',
};