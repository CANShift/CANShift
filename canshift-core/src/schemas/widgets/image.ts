import { z } from 'zod'

import { STRING_CAPS } from '../../constants/firmware-caps.js'

export const ImageWidgetConfigSchema = z
  .object({
    type: z.literal('image'),
    imagePath: z.string().max(STRING_CAPS.IMAGE_PATH),
  })
  .strict()
