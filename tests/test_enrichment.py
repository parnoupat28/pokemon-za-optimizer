import struct,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from enrich_data import decode_container,decode_levels,cs_array,Personal,form_index

class SourceDecoderTests(unittest.TestCase):
 def test_container_offsets_and_truncation(self):
  raw=b'za'+struct.pack('<H',2)+struct.pack('<HHH',10,13,17)+b'abcdefg'
  self.assertEqual(decode_container(raw),[b'abc',b'defg'])
  for invalid in [b'sv'+raw[2:],raw[:6],raw[:-1],b'za'+struct.pack('<HHHH',2,10,9,17)+b'abcdefg']:
   with self.assertRaises(ValueError):decode_container(invalid)
 def test_level_arrays_include_zero_levels_and_alignment_padding(self):
  self.assertEqual(decode_levels(struct.pack('<HH',33,45)+bytes([0,9])),[(33,0),(45,9)])
  self.assertEqual(decode_levels(struct.pack('<H',7)+bytes([1,0])),[(7,1)])
  with self.assertRaises(ValueError):decode_levels(struct.pack('<H',7)+bytes([1,99]))
 def test_cs_data_arrays_ignore_comments_and_decode_hex(self):
  self.assertEqual(cs_array('X => [007, 0x2A, // 500 is a comment\n 010];','X'),[7,42,10])
  with self.assertRaises(ValueError):cs_array('X => [];','Missing')
 def test_personal_form_offsets_and_bounds(self):
  data=bytearray(6*80);data[2*80+26]=3;struct.pack_into('<H',data,2*80+24,4)
  personal=Personal(bytes(data))
  self.assertEqual(personal.get(2,0)[0],2);self.assertEqual(personal.get(2,1)[0],4);self.assertEqual(personal.get(2,2)[0],5)
  with self.assertRaises(ValueError):personal.get(2,3)
 def test_form_mapping_distinguishes_sex_and_multiple_megas(self):
  def index(name,species,form=''):return form_index({'name':name,'species':species,'form':form},None,0)
  self.assertEqual(index('Mega Meowstic','Meowstic','Male'),2)
  self.assertEqual(index('Mega Meowstic','Meowstic','Female'),3)
  self.assertEqual(index('Mega Raichu X','Raichu'),2)
  self.assertEqual(index('Mega Raichu Y','Raichu'),3)
  self.assertEqual(index('Slowbro','Slowbro','Galarian Form'),2)
  self.assertEqual(index('Mega Greninja','Greninja'),3)
  self.assertEqual(index('Mega Floette','Floette'),6)
  self.assertEqual(index('Pumpkaboo','Pumpkaboo','Small Size'),1)
  self.assertIsNone(index('Mega Unknown','Unknown'))

if __name__=='__main__':unittest.main()
