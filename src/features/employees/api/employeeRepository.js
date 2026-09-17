import apiClient from '../../../core/api/apiClient';
import { API_V1_BASE_URL, API_ENDPOINTS } from '../../../core/config/config';

/**
 * Employee Repository for handling Employee CRUD API calls using FormData and Axios
 */
export const employeeRepository = {
  /**
   * Add a new employee via API with multipart FormData
   */
  addEmployee: async (employeeData) => {
    try {
      const formData = new FormData();

      formData.append('name', employeeData.name);
      formData.append('mobileNumber', (employeeData.mobileNumber));
      formData.append('password', employeeData.password);

      const doorNo = employeeData.address?.doorNo;
      const streetName = employeeData.address?.streetName;
      const area = employeeData.address?.area;
      const city = employeeData.address?.city;
      const state = employeeData.address?.state;
      const pincode = employeeData.address?.pincode;

      // Dot notation for Spring WebDataBinder EmployeeRequest.address
      formData.append('address.doorNo', doorNo);
      formData.append('address.streetName', streetName);
      formData.append('address.area', area);
      formData.append('address.city', city);
      formData.append('address.state', state);
      formData.append('address.pincode', pincode);

      // Bracket notation for multipart parsers
      formData.append('address[doorNo]', doorNo);
      formData.append('address[streetName]', streetName);
      formData.append('address[area]', area);
      formData.append('address[city]', city);
      formData.append('address[state]', state);
      formData.append('address[pincode]', pincode);

      // Flat notation for fallback
      formData.append('doorNo', doorNo);
      formData.append('streetName', streetName);
      formData.append('area', area);
      formData.append('city', city);
      formData.append('state', state);
      formData.append('pincode', pincode);

      const cleanAadhaar = (employeeData.aadhaarNumber);
      formData.append('aadhaarNumber', cleanAadhaar);
      formData.append('monthlyBase', String(employeeData.monthlyBase));
      if (employeeData.conveyanceAllowance !== undefined && employeeData.conveyanceAllowance !== null && employeeData.conveyanceAllowance !== '') {
        formData.append('conveyanceAllowance', String(employeeData.conveyanceAllowance));
      }
      if (employeeData.monthlyWorkingDay !== undefined && employeeData.monthlyWorkingDay !== null && employeeData.monthlyWorkingDay !== '') {
        formData.append('monthlyWorkingDay', String(employeeData.monthlyWorkingDay));
      }

      const isOffice = String(employeeData.employeeType || employeeData.role || '').toLowerCase().includes('office');
      const empType = isOffice ? 'OfficeEmployee' : 'FieldEmployee';
      const roleStr = isOffice ? 'Office Employee' : 'Field Employee';

      formData.append('employeeType', empType);
      formData.append('role', roleStr);

      const rawUri = employeeData.image || employeeData.employeeImage;
      let imageUri = typeof rawUri === 'string' ? rawUri.trim() : '';
      if (imageUri && imageUri.startsWith('/') && !imageUri.startsWith('//')) {
        imageUri = `file://${imageUri}`;
      }

      const isLocalImage =
        imageUri &&
        (imageUri.startsWith('file://') ||
         imageUri.startsWith('content://') ||
         imageUri.startsWith('ph://'));

      if (isLocalImage) {
        let filename = imageUri.split('/').pop() || 'employee_photo.jpg';
        filename = filename.split('?')[0].split('#')[0];
        if (!filename.includes('.')) {
          filename = `${filename}.jpg`;
        }
        const match = /\.(\w+)$/.exec(filename);
        const ext = match ? match[1].toLowerCase() : 'jpg';
        const type = ext === 'png' ? 'image/png' : (ext === 'webp' ? 'image/webp' : 'image/jpeg');

        const filePayload = {
          uri: imageUri,
          name: filename,
          type: type === 'image/jpg' ? 'image/jpeg' : type,
        };

        // Append employee photo file payload
        formData.append('employeeImage', filePayload);
      }

      console.log('Sending Add Employee FormData:', formData);

      const response = await apiClient.post(API_ENDPOINTS.EMPLOYEE, formData);

      console.log('Add Employee Response Success:', response.data);
      return {
        success: true,
        data: response.data,
        employee: response.data?.employee || response.data?.data || response.data,
      };
    } catch (error) {
      console.log('Add Employee API Error Details:', error?.response?.data || error?.message);
      if (error?.response?.status === 413 || (error?.message || '').includes('413')) {
        return {
          success: false,
          isFileSizeError: true,
          message: 'File size too large. Add photo up to 3MB.',
        };
      }
      return {
        success: false,
        message: error.response?.data?.message || error.response?.data?.error || error.message || 'Failed to create employee',
      };
    }
  },

  /**
   * Update an existing employee via API with multipart FormData
   */
  updateEmployee: async (id, updatedFields) => {
    try {
      const formData = new FormData();

      if (updatedFields.name || updatedFields.employeeName) {
        formData.append('name', updatedFields.name || updatedFields.employeeName);
      }
      if (updatedFields.mobileNumber || updatedFields.mobile) {
        formData.append('mobileNumber', String(updatedFields.mobileNumber || updatedFields.mobile).replace(/\D/g, ''));
      }
      if (updatedFields.password) {
        formData.append('password', updatedFields.password);
      }

      const doorNo = updatedFields.address?.doorNo || updatedFields.doorNo;
      const streetName = updatedFields.address?.streetName || updatedFields.address?.street || updatedFields.streetName;
      const area = updatedFields.address?.area || updatedFields.area;
      const city = updatedFields.address?.city || updatedFields.city;
      const state = updatedFields.address?.state || updatedFields.state;
      const pincode = updatedFields.address?.pincode || updatedFields.pincode;

      if (doorNo !== undefined) {
        formData.append('address.doorNo', doorNo || '');
        formData.append('address[doorNo]', doorNo || '');
        formData.append('doorNo', doorNo || '');
      }
      if (streetName !== undefined) {
        formData.append('address.streetName', streetName || '');
        formData.append('address[streetName]', streetName || '');
        formData.append('streetName', streetName || '');
      }
      if (area !== undefined) {
        formData.append('address.area', area || '');
        formData.append('address[area]', area || '');
        formData.append('area', area || '');
      }
      if (city !== undefined) {
        formData.append('address.city', city || 'Chennai');
        formData.append('address[city]', city || 'Chennai');
        formData.append('city', city || 'Chennai');
      }
      if (state !== undefined) {
        formData.append('address.state', state || 'Tamil Nadu');
        formData.append('address[state]', state || 'Tamil Nadu');
        formData.append('state', state || 'Tamil Nadu');
      }
      if (pincode !== undefined) {
        formData.append('address.pincode', pincode || '600053');
        formData.append('address[pincode]', pincode || '600053');
        formData.append('pincode', pincode || '600053');
      }

      if (updatedFields.aadhaarNumber || updatedFields.aadhaar) {
        formData.append('aadhaarNumber', String(updatedFields.aadhaarNumber || updatedFields.aadhaar).replace(/\D/g, ''));
      }
      if (updatedFields.monthlyBase || updatedFields.monthlySalary) {
        formData.append('monthlyBase', String(updatedFields.monthlyBase || updatedFields.monthlySalary));
      }
      if (updatedFields.conveyanceAllowance !== undefined && updatedFields.conveyanceAllowance !== null && updatedFields.conveyanceAllowance !== '') {
        formData.append('conveyanceAllowance', String(updatedFields.conveyanceAllowance));
      }
      if (updatedFields.monthlyWorkingDay || updatedFields.workingDaysPerMonth) {
        formData.append('monthlyWorkingDay', String(updatedFields.monthlyWorkingDay || updatedFields.workingDaysPerMonth));
      }

      const isOffice = String(updatedFields.employeeType || updatedFields.role || '').toLowerCase().includes('office');
      const empType = isOffice ? 'OfficeEmployee' : 'FieldEmployee';
      const roleStr = isOffice ? 'Office Employee' : 'Field Employee';

      formData.append('employeeType', empType);
      formData.append('role', roleStr);

      const rawUri = updatedFields.image || updatedFields.employeeImage;
      let imageUri = typeof rawUri === 'string' ? rawUri.trim() : '';
      if (imageUri && imageUri.startsWith('/') && !imageUri.startsWith('//')) {
        imageUri = `file://${imageUri}`;
      }

      const isLocalImage =
        imageUri &&
        (imageUri.startsWith('file://') ||
         imageUri.startsWith('content://') ||
         imageUri.startsWith('ph://'));

      if (isLocalImage) {
        let filename = imageUri.split('/').pop() || 'employee_photo.jpg';
        filename = filename.split('?')[0].split('#')[0];
        if (!filename.includes('.')) {
          filename = `${filename}.jpg`;
        }
        const match = /\.(\w+)$/.exec(filename);
        const ext = match ? match[1].toLowerCase() : 'jpg';
        const type = ext === 'png' ? 'image/png' : (ext === 'webp' ? 'image/webp' : 'image/jpeg');

        const filePayload = {
          uri: imageUri,
          name: filename,
          type: type === 'image/jpg' ? 'image/jpeg' : type,
        };

        // Append employee photo file payload
        formData.append('employeeImage', filePayload);
      }

      const cleanId = String(id).replace(/\D/g, '') || id;
      const updateUrl = `${API_ENDPOINTS.EMPLOYEE}/${cleanId}`;
      console.log(`Sending Update Employee FormData to ${updateUrl}:`, formData);

      let response;
      try {
        response = await apiClient.put(updateUrl, formData);
      } catch (putErr) {
        if (putErr?.response?.status === 405) {
          console.log(`PUT returned 405 on ${updateUrl}, trying POST fallback`);
          response = await apiClient.post(updateUrl, formData);
        } else {
          throw putErr;
        }
      }

      console.log(`Update Employee ${id} Success:`, response.data);
      return {
        success: true,
        data: response.data,
        employee: response.data?.employee || response.data?.data || response.data,
      };
    } catch (error) {
      console.log(`Update Employee ${id} Error:`, error?.response?.data || error?.message);
      if (error?.response?.status === 413 || (error?.message || '').includes('413')) {
        return {
          success: false,
          isFileSizeError: true,
          message: 'File size too large. Add photo up to 3MB.',
        };
      }
      return {
        success: false,
        message: error.response?.data?.message || error.response?.data?.error || error.message || 'Failed to update employee',
      };
    }
  },

  /**
   * Fetch all employees from API
   */
  getEmployees: async () => {
    try {
      const response = await apiClient.get(API_ENDPOINTS.EMPLOYEE);
      const data = response.data;
      const rawList = Array.isArray(data) ? data : data?.employees || data?.data || [];

      const list = rawList.map((emp, index) => {
        let fullImgUrl = emp.employeeImage || emp.image || '';
        if (fullImgUrl && !fullImgUrl.startsWith('http') && !fullImgUrl.startsWith('file://') && !fullImgUrl.startsWith('data:')) {
          fullImgUrl = `${API_V1_BASE_URL}${fullImgUrl.startsWith('/') ? '' : '/'}${fullImgUrl}`;
        }

        const id = emp.id || emp._id;
        const code = emp.code || emp.employeeCode || emp.empCode;
        const name = (emp.name || emp.employeeName || 'Staff').trim();
        const mobile = String(emp.mobileNumber || emp.mobile || emp.phone || '').trim();
        const isOfficeType = String(emp.employeeType || emp.role || '').toLowerCase().includes('office');
        const role = isOfficeType ? 'Office Employee' : 'Field Employee';
        const employeeType = isOfficeType ? 'OfficeEmployee' : 'FieldEmployee';
        const status = emp.status || (emp.isActive === false ? 'Inactive' : 'Active');

        let address = emp.address || '';
        if (typeof address === 'object' && address !== null) {
          address = [address.doorNo, address.streetName, address.area, address.city, address.pincode].filter(Boolean).join(', ');
        } else if (!address && (emp.doorNo || emp.streetName || emp.area || emp.city)) {
          address = [emp.doorNo, emp.streetName, emp.area, emp.city, emp.pincode].filter(Boolean).join(', ');
        }

        return {
          ...emp,
          id,
          _id: emp._id || id,
          code,
          employeeCode: code,
          empId: id,
          name,
          employeeName: name,
          mobileNumber: mobile,
          mobile,
          phone: mobile,
          role,
          status,
          address: typeof emp.address === 'object' ? address : emp.address || address,
          doorNo: emp.doorNo || emp.address?.doorNo || '',
          streetName: emp.streetName || emp.street || emp.address?.streetName || emp.address?.street || '',
          area: emp.area || emp.location || emp.address?.area || emp.address?.location || '',
          city: emp.city || emp.address?.city || '',
          state: emp.state || emp.address?.state || 'Tamil Nadu',
          pincode: emp.pincode || emp.address?.pincode || '',
          aadhaarNumber: emp.aadhaarNumber || emp.aadhaar || '',
          monthlySalary: emp.monthlyBase != null ? Number(emp.monthlyBase) : (emp.monthlySalary != null ? Number(emp.monthlySalary) : null),
          monthlyBase: emp.monthlyBase != null ? Number(emp.monthlyBase) : (emp.monthlySalary != null ? Number(emp.monthlySalary) : null),
          conveyanceAllowance: emp.conveyanceAllowance != null ? Number(emp.conveyanceAllowance) : null,
          workingDaysPerMonth: emp.monthlyWorkingDay != null ? Number(emp.monthlyWorkingDay) : (emp.workingDaysPerMonth != null ? Number(emp.workingDaysPerMonth) : null),
          monthlyWorkingDay: emp.monthlyWorkingDay != null ? Number(emp.monthlyWorkingDay) : (emp.workingDaysPerMonth != null ? Number(emp.workingDaysPerMonth) : null),
          employeeType,
          employeeImage: fullImgUrl,
          image: fullImgUrl,
        };
      });

      return {
        success: true,
        data: list,
        employees: list,
      };
    } catch (error) {
      console.log('Get Employees Error:', error?.response?.data || error?.message);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to fetch employees',
        data: [],
        employees: [],
      };
    }
  },

  /**
   * Fetch a single employee by ID
   * GET /employees/:id
   */
  getEmployeeById: async (id) => {
    try {
      const cleanId = String(id).replace(/\D/g, '') || id;
      const response = await apiClient.get(`${API_ENDPOINTS.EMPLOYEE}/${cleanId}`);
      const data = response.data;
      const raw = data?.employee || data?.data || data;

      let fullImgUrl = raw.employeeImage || raw.image || '';
      if (fullImgUrl && !fullImgUrl.startsWith('http') && !fullImgUrl.startsWith('file://') && !fullImgUrl.startsWith('data:')) {
        fullImgUrl = `${API_V1_BASE_URL}${fullImgUrl.startsWith('/') ? '' : '/'}${fullImgUrl}`;
      }

      const empId = raw.id || raw._id || cleanId;
      const code = raw.code || raw.employeeCode || raw.empCode || `EMP-${empId}`;
      const name = (raw.name || raw.employeeName || 'Staff').trim();
      const mobile = String(raw.mobileNumber || raw.mobile || raw.phone || '').trim();
      const isOfficeType = String(raw.employeeType || raw.role || '').toLowerCase().includes('office');
      const role = isOfficeType ? 'Office Employee' : 'Field Employee';
      const employeeType = isOfficeType ? 'OfficeEmployee' : 'FieldEmployee';
      const status = raw.status || (raw.isActive === false ? 'Inactive' : 'Active');

      let address = raw.address || '';
      if (typeof address === 'object' && address !== null) {
        address = [address.doorNo, address.streetName, address.area, address.city, address.pincode].filter(Boolean).join(', ');
      } else if (!address && (raw.doorNo || raw.streetName || raw.area || raw.city)) {
        address = [raw.doorNo, raw.streetName, raw.area, raw.city, raw.pincode].filter(Boolean).join(', ');
      }

      const normalized = {
        ...raw,
        id: empId,
        _id: raw._id || empId,
        code,
        employeeCode: code,
        name,
        employeeName: name,
        mobileNumber: mobile,
        mobile,
        phone: mobile,
        role,
        status,
        address: typeof raw.address === 'object' ? address : raw.address || address,
        doorNo: raw.doorNo || raw.address?.doorNo || '',
        streetName: raw.streetName || raw.street || raw.address?.streetName || raw.address?.street || '',
        area: raw.area || raw.location || raw.address?.area || raw.address?.location || '',
        city: raw.city || raw.address?.city || '',
        state: raw.state || raw.address?.state || 'Tamil Nadu',
        pincode: raw.pincode || raw.address?.pincode || '',
        aadhaarNumber: raw.aadhaarNumber || raw.aadhaar || '',
        monthlySalary: raw.monthlyBase != null ? Number(raw.monthlyBase) : (raw.monthlySalary != null ? Number(raw.monthlySalary) : null),
        monthlyBase: raw.monthlyBase != null ? Number(raw.monthlyBase) : (raw.monthlySalary != null ? Number(raw.monthlySalary) : null),
        conveyanceAllowance: raw.conveyanceAllowance != null ? Number(raw.conveyanceAllowance) : null,
        workingDaysPerMonth: raw.monthlyWorkingDay != null ? Number(raw.monthlyWorkingDay) : (raw.workingDaysPerMonth != null ? Number(raw.workingDaysPerMonth) : null),
        monthlyWorkingDay: raw.monthlyWorkingDay != null ? Number(raw.monthlyWorkingDay) : (raw.workingDaysPerMonth != null ? Number(raw.workingDaysPerMonth) : null),
        employeeType,
        employeeImage: fullImgUrl,
        image: fullImgUrl,
      };

      return {
        success: true,
        data: normalized,
        employee: normalized,
      };
    } catch (error) {
      console.log(`Get Employee ${id} Error:`, error?.response?.data || error?.message);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to fetch employee details',
        employee: null,
      };
    }
  },

  /**
   * Delete an employee
   */
  deleteEmployee: async (id) => {
    try {
      const response = await apiClient.delete(`${API_ENDPOINTS.EMPLOYEE}/${id}`);
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to delete employee',
      };
    }
  },
};

export default employeeRepository;
