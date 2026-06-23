import { db } from '../src/lib/db'

async function seed() {
  console.log('🌱 Seeding database...')

  // Create Spa
  const spa = await db.spa.create({
    data: {
      name: 'Spa Thiên Đường',
      pin: '1234',
      phone: '0901234567',
      openTime: '08:00',
      closeTime: '22:00',
      botActive: true,
      config: {
        create: {
          botGreeting: 'Xin chào! Tôi là CS Bot của Spa Thiên Đường. Tôi có thể giúp gì cho bạn?',
          botName: 'CS Bot',
        },
      },
    },
  })

  // Create Branches
  const branch1 = await db.branch.create({
    data: { name: 'Chi nhánh Quận 1', address: '123 Nguyễn Huệ, Q.1', spaId: spa.id },
  })
  const branch2 = await db.branch.create({
    data: { name: 'Chi nhánh Quận 3', address: '456 Võ Văn Tần, Q.3', spaId: spa.id },
  })
  const branch3 = await db.branch.create({
    data: { name: 'Chi nhánh Thủ Đức', address: '789 Xa lộ Hà Nội, TP. Thủ Đức', spaId: spa.id },
  })

  // Create Services
  const services = await Promise.all([
    db.service.create({ data: { name: 'Massage cổ vai gáy', price: 200000, duration: 45, spaId: spa.id } }),
    db.service.create({ data: { name: 'Massage body toàn thân', price: 350000, duration: 60, spaId: spa.id } }),
    db.service.create({ data: { name: 'Chăm sóc da mặt cơ bản', price: 250000, duration: 45, spaId: spa.id } }),
    db.service.create({ data: { name: 'Chăm sóc da mặt nâng cao', price: 450000, duration: 60, spaId: spa.id } }),
    db.service.create({ data: { name: 'Gội đầu dưỡng sinh', price: 150000, duration: 30, spaId: spa.id } }),
    db.service.create({ data: { name: 'Làm nail cơ bản', price: 120000, duration: 30, spaId: spa.id } }),
    db.service.create({ data: { name: 'Làm nail thiết kế', price: 250000, duration: 60, spaId: spa.id } }),
    db.service.create({ data: { name: 'Triệt lông vùng mặt', price: 180000, duration: 20, spaId: spa.id } }),
    db.service.create({ data: { name: 'Triệt lông toàn thân', price: 800000, duration: 90, spaId: spa.id } }),
    db.service.create({ data: { name: 'Xông hơi thảo mộc', price: 150000, duration: 30, spaId: spa.id } }),
  ])

  // Create Customers
  const customers = await Promise.all([
    db.customer.create({ data: { name: 'Nguyễn Thị Mai', phone: '0901111222', spaId: spa.id } }),
    db.customer.create({ data: { name: 'Trần Văn Hùng', phone: '0902222333', spaId: spa.id } }),
    db.customer.create({ data: { name: 'Lê Thị Hương', phone: '0903333444', spaId: spa.id } }),
    db.customer.create({ data: { name: 'Phạm Minh Tuấn', phone: '0904444555', spaId: spa.id } }),
    db.customer.create({ data: { name: 'Hoàng Thị Lan', phone: '0905555666', spaId: spa.id } }),
    db.customer.create({ data: { name: 'Vũ Đức Anh', phone: '0906666777', spaId: spa.id } }),
    db.customer.create({ data: { name: 'Đỗ Thị Ngọc', phone: '0907777888', spaId: spa.id } }),
    db.customer.create({ data: { name: 'Bùi Văn Thành', phone: '0908888999', spaId: spa.id } }),
    db.customer.create({ data: { name: 'Ngô Thị Hoa', phone: '0909999000', spaId: spa.id } }),
    db.customer.create({ data: { name: 'Lý Minh Khôi', phone: '0911111222', spaId: spa.id } }),
    db.customer.create({ data: { name: 'Trịnh Thị Yến', phone: '0912222333', spaId: spa.id } }),
    db.customer.create({ data: { name: 'Đặng Văn Phú', phone: '0913333444', spaId: spa.id } }),
  ])

  // Create Bookings with various statuses
  const now = new Date()
  const bookingData = [
    { customerId: customers[0].id, serviceId: services[1].id, branchId: branch1.id, status: 'pending', bookingTime: new Date(now.getTime() + 3600000), note: 'Dễ bị đau vai' },
    { customerId: customers[1].id, serviceId: services[2].id, branchId: branch1.id, status: 'pending', bookingTime: new Date(now.getTime() + 7200000), note: null },
    { customerId: customers[2].id, serviceId: services[0].id, branchId: branch2.id, status: 'pending', bookingTime: new Date(now.getTime() + 5400000), note: 'Khách VIP' },
    { customerId: customers[3].id, serviceId: services[4].id, branchId: branch2.id, status: 'pending', bookingTime: new Date(now.getTime() + 9000000), note: null },
    { customerId: customers[4].id, serviceId: services[3].id, branchId: branch1.id, status: 'pending', bookingTime: new Date(now.getTime() + 10800000), note: 'Da nhạy cảm' },
    { customerId: customers[5].id, serviceId: services[5].id, branchId: branch3.id, status: 'confirmed', bookingTime: new Date(now.getTime() - 3600000), note: null },
    { customerId: customers[6].id, serviceId: services[1].id, branchId: branch1.id, status: 'confirmed', bookingTime: new Date(now.getTime() - 7200000), note: null },
    { customerId: customers[7].id, serviceId: services[6].id, branchId: branch2.id, status: 'confirmed', bookingTime: new Date(now.getTime() + 1800000), note: null },
    { customerId: customers[8].id, serviceId: services[8].id, branchId: branch1.id, status: 'completed', bookingTime: new Date(now.getTime() - 86400000), note: null },
    { customerId: customers[9].id, serviceId: services[9].id, branchId: branch3.id, status: 'completed', bookingTime: new Date(now.getTime() - 172800000), note: null },
    { customerId: customers[10].id, serviceId: services[0].id, branchId: branch2.id, status: 'cancelled', bookingTime: new Date(now.getTime() - 43200000), note: 'Khách bận' },
    { customerId: customers[11].id, serviceId: services[3].id, branchId: branch1.id, status: 'completed', bookingTime: new Date(now.getTime() - 259200000), note: null },
  ]

  for (const b of bookingData) {
    await db.booking.create({
      data: {
        customerId: b.customerId,
        serviceId: b.serviceId,
        branchId: b.branchId,
        spaId: spa.id,
        status: b.status,
        bookingTime: b.bookingTime,
        note: b.note,
      },
    })
  }

  // Create Chat Logs
  const sessionIds = ['sess-001', 'sess-002', 'sess-003', 'sess-004', 'sess-005', 'sess-006']
  const chatConversations = [
    [
      { sender: 'user', content: 'Xin chào, mình muốn đặt lịch massage body', sessionId: sessionIds[0] },
      { sender: 'bot', content: 'Xin chào! Dạ, massage body toàn thân bên mình có giá 350.000đ cho 60 phút. Bạn muốn đặt lịch giờ nào ạ?', sessionId: sessionIds[0] },
      { sender: 'user', content: 'Mình muốn đặt 2 giờ chiều mai', sessionId: sessionIds[0] },
      { sender: 'bot', content: 'Dạ, đã ghi nhận. Bạn muốn đặt ở chi nhánh nào? Bên mình có chi nhánh Quận 1, Quận 3 và Thủ Đức ạ.', sessionId: sessionIds[0] },
      { sender: 'user', content: 'Chi nhánh Quận 1 nhé', sessionId: sessionIds[0] },
      { sender: 'bot', content: 'Dạ đã đặt lịch thành công! Massage body toàn thân lúc 14:00 ngày mai tại chi nhánh Quận 1. Cảm ơn bạn!', sessionId: sessionIds[0] },
    ],
    [
      { sender: 'user', content: 'Cho mình hỏi giá làm nail', sessionId: sessionIds[1] },
      { sender: 'bot', content: 'Dạ, bên mình có 2 gói nail: Làm nail cơ bản 120.000đ (30 phút) và Làm nail thiết kế 250.000đ (60 phút). Bạn quan tâm gói nào ạ?', sessionId: sessionIds[1] },
      { sender: 'user', content: 'Mình lấy nail thiết kế', sessionId: sessionIds[1] },
      { sender: 'bot', content: 'Dạ tốt quá! Bạn muốn đặt lịch luôn không ạ? Để mình hỗ trợ bạn.', sessionId: sessionIds[1] },
    ],
    [
      { sender: 'user', content: 'Spa có dịch vụ triệt lông không?', sessionId: sessionIds[2] },
      { sender: 'bot', content: 'Dạ có! Bên mình có triệt lông vùng mặt 180.000đ (20 phút) và triệt lông toàn thân 800.000đ (90 phút). Bạn muốn tìm hiểu thêm ạ?', sessionId: sessionIds[2] },
      { sender: 'user', content: 'Cho mình giá triệt lông toàn thân bên mình nhé', sessionId: sessionIds[2] },
      { sender: 'bot', content: 'Triệt lông toàn thân bên mình giá 800.000đ cho buổi 90 phút. Hiện đang có chương trình mua 5 tặng 1. Bạn muốn đặt lịch không ạ?', sessionId: sessionIds[2] },
    ],
    [
      { sender: 'user', content: 'Mình muốn hủy lịch đặt ngày mai', sessionId: sessionIds[3] },
      { sender: 'bot', content: 'Dạ, bạn cho mình xin số điện thoại đã đặt lịch để mình kiểm tra nhé.', sessionId: sessionIds[3] },
      { sender: 'user', content: '0901111222', sessionId: sessionIds[3] },
      { sender: 'bot', content: 'Dạ mình tìm thấy lịch đặt massage body lúc 14:00 ngày mai tại chi nhánh Quận 1. Bạn xác nhận muốn hủy đúng không ạ?', sessionId: sessionIds[3] },
      { sender: 'user', content: 'Đúng rồi, hủy giúp mình', sessionId: sessionIds[3] },
      { sender: 'bot', content: 'Dạ đã hủy lịch thành công. Hẹn gặp lại bạn lần sau nhé!', sessionId: sessionIds[3] },
    ],
    [
      { sender: 'user', content: 'Spa mở mấy giờ vậy?', sessionId: sessionIds[4] },
      { sender: 'bot', content: 'Dạ, Spa Thiên Đường mở cửa từ 8:00 sáng đến 22:00 mỗi ngày ạ. Bạn cần đặt lịch không?', sessionId: sessionIds[4] },
    ],
    [
      { sender: 'user', content: 'Cho mình hỏi gội đầu dưỡng sinh giá bao nhiêu', sessionId: sessionIds[5] },
      { sender: 'bot', content: 'Gội đầu dưỡng sinh bên mình giá 150.000đ cho 30 phút. Bạn muốn đặt lịch ạ?', sessionId: sessionIds[5] },
      { sender: 'user', content: 'Đặt cho mình 3 giờ chiều nay tại Q3', sessionId: sessionIds[5] },
      { sender: 'bot', content: 'Dạ đã đặt lịch thành công! Gội đầu dưỡng sinh lúc 15:00 hôm nay tại chi nhánh Quận 3. Cảm ơn bạn!', sessionId: sessionIds[5] },
    ],
  ]

  // Distribute chat logs across customers and time periods
  const chatTimeOffsets = [
    [0, 60000, 120000, 180000, 240000, 300000], // today
    [0, 45000, 90000, 135000, 180000, 225000],   // today
    [0, 30000, 60000, 90000],                     // today
    [86400000, 86460000, 86490000, 86495000, 86500000, 86505000], // yesterday
    [172800000, 172830000],                       // 2 days ago
    [3600000, 3645000, 3690000, 3695000],         // today
  ]

  const customerChatMapping = [0, 1, 2, 3, 4, 5]
  const branchChatMapping = [branch1.id, branch3.id, branch2.id, branch1.id, branch2.id, branch2.id]

  for (let convIdx = 0; convIdx < chatConversations.length; convIdx++) {
    const conv = chatConversations[convIdx]
    const customer = customers[customerChatMapping[convIdx]]
    const branchId = branchChatMapping[convIdx]
    const timeOffsets = chatTimeOffsets[convIdx]

    for (let msgIdx = 0; msgIdx < conv.length; msgIdx++) {
      const msg = conv[msgIdx]
      await db.chatLog.create({
        data: {
          customerId: customer.id,
          spaId: spa.id,
          branchId: branchId,
          sender: msg.sender,
          content: msg.content,
          sessionId: msg.sessionId,
          createdAt: new Date(now.getTime() - (timeOffsets[msgIdx] || 0)),
        },
      })
    }
  }

  // Add more chat logs spread across past days for dashboard stats
  const pastCustomers = [customers[6], customers[7], customers[8], customers[9], customers[10], customers[11]]
  for (let day = 1; day <= 7; day++) {
    for (let hour = 8; hour <= 21; hour++) {
      const numMsgs = Math.floor(Math.random() * 4)
      for (let m = 0; m < numMsgs; m++) {
        const cust = pastCustomers[Math.floor(Math.random() * pastCustomers.length)]
        const isUser = Math.random() > 0.5
        const date = new Date(now)
        date.setDate(date.getDate() - day)
        date.setHours(hour, Math.floor(Math.random() * 60), 0, 0)
        
        const userMessages = [
          'Cho mình hỏi giá massage', 'Spa có chỗ trống không', 'Mình muốn đặt lịch',
          'Giá làm da mặt bao nhiêu', 'Có khuyến mãi gì không', 'Cho mình đổi giờ',
          'Spa ở đâu vậy', 'Mình muốn tư vấn dịch vụ', 'Có gói combo không',
        ]
        const botMessages = [
          'Dạ, bên mình có nhiều gói dịch vụ. Bạn quan tâm dịch vụ nào ạ?',
          'Dạ có ạ, bạn muốn đặt giờ nào?', 'Dạ để mình kiểm tra lịch trống cho bạn nhé.',
          'Dạ, giá dịch vụ bên mình từ 120.000đ đến 800.000đ tùy gói.',
          'Dạ hiện bên mình đang có ưu đãi mua 5 tặng 1 ạ.',
          'Dạ được, bạn muốn đổi sang giờ nào ạ?',
          'Bên mình có 3 chi nhánh: Q.1, Q.3 và Thủ Đức ạ.',
          'Dạ, bạn cho mình biết nhu cầu để mình tư vấn nhé.',
          'Dạ có gói combo massage + chăm sóc da giá 500.000đ ạ.',
        ]

        await db.chatLog.create({
          data: {
            customerId: cust.id,
            spaId: spa.id,
            branchId: [branch1.id, branch2.id, branch3.id][Math.floor(Math.random() * 3)],
            sender: isUser ? 'user' : 'bot',
            content: isUser 
              ? userMessages[Math.floor(Math.random() * userMessages.length)]
              : botMessages[Math.floor(Math.random() * botMessages.length)],
            sessionId: `sess-past-${day}-${hour}-${m}`,
            createdAt: date,
          },
        })
      }
    }
  }

  console.log('✅ Seed completed!')
  console.log(`  Spa: ${spa.name} (PIN: 1234)`)
  console.log(`  Branches: 3`)
  console.log(`  Services: ${services.length}`)
  console.log(`  Customers: ${customers.length}`)
  console.log(`  Bookings: ${bookingData.length}`)
}

seed()
  .catch(console.error)
  .finally(() => db.$disconnect())
